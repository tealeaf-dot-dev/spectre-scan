import { Relay } from "nostr-tools";
import { useWebSocketImplementation } from 'nostr-tools/relay';
import WebSocket from 'ws';
import { finalize, from, mergeMap, Observable, repeat, retry, Subscriber, defer, Subject, takeUntil, map } from "rxjs";
import { IRelayScannerPort } from "../../../core/scanners/pubkey/ports/nostr/IRelayScannerPort.js";
import { IEvent } from "../../../shared/interfaces/IEvent.js";
import { FiltersList, RelayURL, RelayURLList } from "../../../shared/types.js";
import { stringifyError } from "../../../shared/functions/stringifyError.js";
import { INostrToolsRelayScannerConfig } from "./interfaces/INostrToolsRelayScannerConfig.js";

useWebSocketImplementation(WebSocket);

export abstract class AbstractNostrToolsSource<T> implements IRelayScannerPort<T> {
    #stopSignal$ = new Subject<void>();
    #relayURLs: RelayURLList;
    #retryDelay: number;

    constructor({ relayURLs, retryDelay = 60000 }: INostrToolsRelayScannerConfig) {
        this.#relayURLs = relayURLs;
        this.#retryDelay = retryDelay;
    }

    get relayURLs(): RelayURLList {

        return this.#relayURLs;
    }

    get retryDelay(): number {

        return this.#retryDelay;
    }

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

    protected abstract transform(evt: IEvent): T;

    scan(filters: FiltersList): Observable<T> {

        return from(this.#relayURLs).pipe(
            mergeMap(relayURL => AbstractNostrToolsSource.#connectToRelay(relayURL).pipe(
                retry({ delay: this.#retryDelay }),
                mergeMap(relay => AbstractNostrToolsSource.#subscribeToRelay(relay, filters).pipe(
                    takeUntil(this.#stopSignal$),
                    finalize(() => { 
                        console.log(`Closing connection to ${relay.url}`);
                        relay.close();
                    }),
                )),
                finalize(() => { console.log(`Disconnected from ${relayURL}`); }),
                repeat({ delay: this.#retryDelay }),
                takeUntil(this.#stopSignal$),
            )),
            map((evt: IEvent) => this.transform(evt)),
        );
    }
}
