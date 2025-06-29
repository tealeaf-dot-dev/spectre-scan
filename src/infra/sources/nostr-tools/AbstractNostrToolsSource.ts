import { Relay } from "nostr-tools";
import { useWebSocketImplementation } from 'nostr-tools/relay';
import WebSocket from 'ws';
import { finalize, from, mergeMap, Observable, repeat, retry, Subscriber, Subject, takeUntil, map, share } from "rxjs";
import { RelayURL, RelayURLList } from "../data/types.js";
import { INostrToolsSourceConfig } from "./interfaces/INostrToolsSourceConfig.js";
import { IScannerSourcePort } from "../../../core/scanners/generic/ports/source/IScannerSourcePort.js";
import { IEventBusPort } from "../../../core/eventing/ports/event-bus/IEventBusPort.js";
import { stringifyError } from "../../../shared/utils/stringifyError.js";
import { IScannerSourcePortResponse } from "../../../core/scanners/generic/ports/source/IScannerSourcePortResponse.js";
import { IScannerSourcePortRequest } from "../../../core/scanners/generic/ports/source/IScannerSourcePortRequest.js";
import { AbstractDomainErrorEvent } from "../../../core/eventing/events/AbstractDomainErrorEvent.js";
import { AbstractDomainActionEvent } from "../../../core/eventing/events/AbstractDomainActionEvent.js";
import { IDomainEventData } from "../../../core/eventing/data/IDomainEventData.js";
import { IDomainEvent } from "../../../core/eventing/events/IDomainEvent.js";
import { Either } from "fp-ts/lib/Either.js";
import { FiltersList } from "../../../core/data/types.js";
import { IEvent } from "../../../core/data/IEvent.js";

useWebSocketImplementation(WebSocket);

export abstract class AbstractNostrToolsSource<
    ErrorEvent extends AbstractDomainErrorEvent,
    SuccessEvent extends AbstractDomainActionEvent<IDomainEventData>,
    SourceRequest extends IScannerSourcePortRequest,
    SourceResponse extends IScannerSourcePortResponse<ErrorEvent, SuccessEvent>
> implements IScannerSourcePort<SourceRequest, SourceResponse> {
    #stopSignal$ = new Subject<void>();
    #relayURLs: RelayURLList;
    #retryDelay: number;
    #connectionTimeoutDelay: number;
    protected readonly _eventBus: IEventBusPort;

    constructor({ eventBus, relayURLs, retryDelay = 60000, connectionTimeoutDelay = 4000 }: INostrToolsSourceConfig) {
        this.#relayURLs = relayURLs;
        this.#retryDelay = retryDelay;
        this.#connectionTimeoutDelay = connectionTimeoutDelay;
        this._eventBus = eventBus;
    }

    get eventBus(): IEventBusPort {

        return this._eventBus;
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

    protected publishEvent(evt: IDomainEvent<IDomainEventData>) {
        evt.setPublishedBy(this.constructor.name);
        this.eventBus.publish(evt);
    }

    protected abstract publishNotification(message: string): void;

    protected abstract publishError(error: string): void;

    #connectToRelay(relayURL: RelayURL): Observable<Relay> {

        return new Observable<Relay>(subscriber => {
            this.publishNotification(`Connecting to ${relayURL}`);

            const relay = new Relay(relayURL);

            relay.connectionTimeout = this.#connectionTimeoutDelay;

            const connection = relay.connect();

            connection
                .then(_ => {
                    this.publishNotification(`Connected to ${relayURL}`);
                    subscriber.next(relay);
                })
                .catch((error: unknown) => {
                    this.publishError(`Failed to connect to ${relayURL}: ${stringifyError(error)}`);

                    subscriber.error(
                        error instanceof Error ? error : new Error(`Connection error: ${String(error)}`)
                    );
                });

            relay.onclose = () => {
                const err = `${relayURL} returned an error or closed the connection`;
                this.publishError(err);
                subscriber.error(err);
            };

            return () => {
                setTimeout(() => {
                    relay.close();
                }, 50); // give a little delay to allow subscriptions to close before closing the connection
            };
        });
    }

    #subscribeToRelay(relay: Relay, filters: FiltersList): Observable<IEvent> {
        this.publishNotification(`Subscribing to ${relay.url}`);

        const otherReasonsForClosing = [
            'relay connection timed out',
            'relay connection errored',
            'relay connection closed',
            'relay connection closed by us',
            `Unsubscribing from ${relay.url}`,
        ];

        return new Observable<IEvent>((subscriber: Subscriber<IEvent>) => {
            const subscription = relay.subscribe(filters, {
                onevent: (event: IEvent) => {
                    subscriber.next(event);
                },
                onclose: (reason: string) => {
                    // when the relay closes the subscription by sending a 'CLOSED' event, we need to send an error signal to the subscriber which will then retry subscribing
                    // under all other circumstances we need to complete the subscriber instead of erroring
                    // so we need to distinguish between the case that the relay sends a 'CLOSED' event and the cases where onclose is called due to these other reasons:
                    // a) the relay closing the websocket connection (which is handled by creating a new relay connection)
                    // b) the subscription being closed by us
                    // we do that by checking the reason given for closing against strings that are internal to nostr-tools and those provided by us
                    // which is icky but there's no alternative

                    if (otherReasonsForClosing.includes(reason)) {
                        subscriber.complete();
                    } else {
                        const err = `${relay.url} closed the subscription`;
                        this.publishError(err);
                        subscriber.error(err);
                    }
                },
            });

            return () => {
                subscription.close(`Unsubscribing from ${relay.url}`);
            };
        });
    }

    protected abstract transform(evt: IEvent): Either<ErrorEvent, SuccessEvent>;

    start({ filters }: SourceRequest): SourceResponse {

        return from(this.#relayURLs).pipe(
            mergeMap(relayURL => this.#connectToRelay(relayURL).pipe(
                retry({ delay: this.#retryDelay }),
                mergeMap(relay => this.#subscribeToRelay(relay, filters).pipe(
                    retry({ delay: this.#retryDelay }),
                    takeUntil(this.#stopSignal$),
                )),
                finalize(() => { this.publishError(`Disconnected from ${relayURL}`); }),
                repeat({ delay: this.#retryDelay }),
                takeUntil(this.#stopSignal$),
            )),
            map((evt: IEvent) => this.transform(evt)),
            share(),
        ) as SourceResponse;
    }
}
