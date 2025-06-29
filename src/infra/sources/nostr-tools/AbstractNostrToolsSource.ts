import { Relay } from "nostr-tools";
import { useWebSocketImplementation } from 'nostr-tools/relay';
import WebSocket from 'ws';
import { from, mergeMap, Observable, retry, Subscriber, map, share, tap } from "rxjs";
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

    protected publishEvent(evt: IDomainEvent<IDomainEventData>) {
        evt.setPublishedBy(this.constructor.name);
        this.eventBus.publish(evt);
    }

    protected abstract publishNotification(message: string): void;

    protected abstract publishError(error: string): void;

    #connectToRelay(relayURL: RelayURL): Observable<Relay> {

        return new Observable<Relay>(subscriber => {
            const relay = new Relay(relayURL);

            relay.connectionTimeout = this.#connectionTimeoutDelay;

            const connection = relay.connect();

            connection
                .then(_ => {
                    subscriber.next(relay);
                })
                .catch((error: unknown) => {
                    subscriber.error(`Failed to connect to ${relayURL}: ${stringifyError(error)}`);
                });

            relay.onclose = () => {
                subscriber.error(`${relayURL} returned an error or closed the connection`);
            };

            return () => {
                if (relay.connected) {
                    setTimeout(() => {
                        relay.close();
                    }, 50); // give subscriptions time to close before closing the connection
                }
            };
        });
    }

    #weUnsubscribedMessage(relay: Relay): string {

        return `${relay.url} subscription closed by us`;
    }

    #subscribeToRelay(relay: Relay, filters: FiltersList): Observable<IEvent> {
        const relayConnectionClosedMessages = [
            'relay connection timed out',
            'relay connection errored',
            'relay connection closed',
            'relay connection closed by us',
        ];

        return new Observable<IEvent>((subscriber: Subscriber<IEvent>) => {
            const subscription = relay.subscribe(filters, {
                onevent: (event: IEvent) => {
                    subscriber.next(event);
                },
                onclose: (reason: string) => {
                    // the subscription was closed because either:
                    // a) the relay closed it by sending a 'CLOSED' event
                    // b) the relay connection closed
                    // c) we closed it
                    // in case a) we need to send an error signal to the subscribe Observable so that it will resubscribe
                    // in case b) the relay Observable will reconnect (unless we closed it) and trigger resubscription, so we just need to send a complete signal to the subscribe Observable
                    // in case c) we do nothing
                    // we determine case a-c) by comparing the reason given for closing against strings that are internal to nostr-tools and those provided by us
                    // which is icky but there's no alternative

                    if (relayConnectionClosedMessages.includes(reason)) {
                        subscriber.complete();
                    } else if (reason !== this.#weUnsubscribedMessage(relay)) {
                        subscriber.error(`${relay.url} closed the subscription`);
                    }
                },
            });

            return () => {
                if (!subscription.closed) {
                    subscription.close(this.#weUnsubscribedMessage(relay));
                }
            };
        });
    }

    protected abstract transform(evt: IEvent): Either<ErrorEvent, SuccessEvent>;

    start({ filters }: SourceRequest): SourceResponse {

        return from(this.#relayURLs).pipe(
            mergeMap(relayURL => this.#connectToRelay(relayURL).pipe(
                tap({
                    error: (e: string) => { this.publishError(`Disconnected from ${relayURL} because: ${e}`); },
                    next: (relay: Relay) => { if (relay.connected) this.publishNotification(`Connected to ${relayURL}`); },
                    subscribe: () => { this.publishNotification(`Connecting to ${relayURL}`); },
                    unsubscribe: () => { this.publishNotification(`Disconnected from ${relayURL}`); },
                }),
                retry({ delay: this.#retryDelay }),
                mergeMap(relay => this.#subscribeToRelay(relay, filters).pipe(
                    tap({
                        error: (e: string) => { this.publishError(`Unsubscribed from ${relay.url} because: ${e}`); },
                        complete: () => { this.publishNotification(`Unsubscribed from ${relay.url}`); },
                        subscribe: () => { this.publishNotification(`Subscribing to ${relay.url}`); },
                        unsubscribe: () => { this.publishNotification(`Unsubscribed from ${relay.url}`); },
                    }),
                    retry({ delay: this.#retryDelay }),
                )),
            )),
            map((evt: IEvent) => this.transform(evt)),
            share(),
        ) as SourceResponse;
    }
}
