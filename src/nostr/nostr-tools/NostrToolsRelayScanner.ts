import { Relay } from "nostr-tools";
import { useWebSocketImplementation } from 'nostr-tools/relay';
import WebSocket from 'ws';
import { finalize, from, map, mergeMap, Observable, repeat, retry, Subscriber, defer, Subject, takeUntil } from "rxjs";
import { IRelayScannerPort } from "../../core/pubkey-scanner/ports/nostr/IRelayScannerPort.js";
import { IEvent } from "../../shared/interfaces/IEvent.js";
import { FiltersList, Pubkey, RelayURL, RelayURLList } from "../../shared/types.js";
import { stringifyError } from "../../shared/functions/stringifyError.js";

useWebSocketImplementation(WebSocket);

export class NostrToolsRelayScanner implements IRelayScannerPort {
    #stopSignal$ = new Subject<void>();

    stop(): void {
        this.#stopSignal$.next();
    }

    static #connectToRelay(relayURL: RelayURL): Observable<Relay> {

        return defer(() => {
            console.log(`Connecting to ${relayURL}`);

            return from(
                Relay.connect(relayURL)
                    .then((relay) => {
                        console.log(`Connected to ${relayURL}`);

                        return relay;
                    })
                    .catch((error: unknown) => {
                        console.log(`Failed to connect to ${relayURL}: ${stringifyError(error)}`);

                        if (error instanceof Error) {
                            throw error;
                        } else {
                            throw new Error(`Connection error: ${String(error)}`);
                        }
                    })
            );
        });
    }

    static #subscribeToRelay(relay: Relay, filters: FiltersList): Observable<IEvent> {
        console.log(`Subscribing to ${relay.url}`);

        return new Observable<IEvent>((subscriber: Subscriber<IEvent>) => {
            const subscription = relay.subscribe(filters, {
                onevent(event: IEvent) {
                    subscriber.next(event);
                },
                onclose() {
                    subscriber.complete();
                },
            });

            return () => { subscription.close(); };
        });
    }

    scan(relayURLs: RelayURLList, filters: FiltersList, retryDelay: number = 60000): Observable<Pubkey> {

        return from(relayURLs).pipe(
            takeUntil(this.#stopSignal$),
            mergeMap(relayURL => NostrToolsRelayScanner.#connectToRelay(relayURL).pipe(
                retry({ delay: retryDelay }),
                mergeMap(relay => NostrToolsRelayScanner.#subscribeToRelay(relay, filters).pipe(
                    takeUntil(this.#stopSignal$),
                    finalize(() => { 
                        console.log(`Closing connection to ${relay.url}`);
                        relay.close();
                    }),
                )),
                finalize(() => { console.log(`Disconnected from ${relayURL}`); }),
                repeat({ delay: retryDelay }),
                takeUntil(this.#stopSignal$),
            )),
            map(event => event.pubkey),
            takeUntil(this.#stopSignal$),
        );
    }
}
