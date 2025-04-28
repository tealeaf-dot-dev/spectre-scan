import { Relay } from "nostr-tools";
import { useWebSocketImplementation } from 'nostr-tools/relay';
import WebSocket from 'ws';
import { defer, finalize, from, map, mergeMap, Observable, repeat, retry, Subscriber } from "rxjs";
import { IRelayScannerPort } from "../../core/pubkey-scanner/ports/nostr/IRelayScannerPort.js";
import { IEvent } from "../../shared/interfaces/IEvent.js";
import { FiltersList, Pubkey, RelayURL, RelayURLList } from "../../shared/types.js";

useWebSocketImplementation(WebSocket);

export class NostrToolsRelayScanner implements IRelayScannerPort {
    static #connectToRelay(relayURL: RelayURL): Observable<Relay> {

        return defer((): Observable<Relay> => {
            console.log(`Connecting to ${relayURL}`);

            return from(Relay.connect(relayURL).then((relay) => {
                console.log(`Connected to ${relayURL}`);

                return relay;
            }).catch((error: unknown) => {
                console.log(`Failed to connect to ${relayURL}: ${error instanceof Error ? error.message : String(error)}`);

                if (error instanceof Error) {
                    throw error;
                } else {
                    throw new Error(`Connection error: ${String(error)}`);
                }
            }));
        });
    }

    static #subscribeToRelay(relay: Relay, filters: FiltersList): Observable<IEvent> {

        return new Observable<IEvent>((subscriber: Subscriber<IEvent>) => {
            const subscription = relay.subscribe(filters, {
                onevent(event: IEvent) {
                    subscriber.next(event);
                },
                onclose() {
                    subscriber.complete();
                },
            });

            return () => { subscription.close() };
        });
    }

    scan(relayURLs: RelayURLList, filters: FiltersList): Observable<Pubkey> {

        return from(relayURLs).pipe(
            mergeMap(relayURL => NostrToolsRelayScanner.#connectToRelay(relayURL).pipe(
                retry({ delay: 60000 }),
                mergeMap(relay => NostrToolsRelayScanner.#subscribeToRelay(relay, filters)),
                finalize(() => { console.log(`Disconnected from ${relayURL}`) }),
                repeat({ delay: 60000 }),
            )),
            map(event => event.pubkey),
        );
    }
}
