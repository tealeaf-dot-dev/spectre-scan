import { Relay } from "nostr-tools";
import { useWebSocketImplementation } from 'nostr-tools/relay';
import WebSocket from 'ws';
import { finalize, from, mergeMap, Observable, repeat, retry, Subscriber, defer, Subject, takeUntil, map } from "rxjs";
import { RelayURL, RelayURLList } from "../shared/types.js";
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
    protected readonly _eventBus: IEventBusPort;

    constructor({ eventBus, relayURLs, retryDelay = 60000 }: INostrToolsSourceConfig) {
        this.#relayURLs = relayURLs;
        this.#retryDelay = retryDelay;
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

        return defer(() => {
            this.publishNotification(`Connecting to ${relayURL}`);

            return from(
                Relay.connect(relayURL)
                    .then((relay) => {
                        this.publishNotification(`Connected to ${relayURL}`);

                        return relay;
                    })
                    .catch((error: unknown) => {
                        this.publishError(`Failed to connect to ${relayURL}: ${stringifyError(error)}`);

                        if (error instanceof Error) {
                            throw error;
                        } else {
                            throw new Error(`Connection error: ${String(error)}`);
                        }
                    })
            );
        });
    }

    #subscribeToRelay(relay: Relay, filters: FiltersList): Observable<IEvent> {
        this.publishNotification(`Subscribing to ${relay.url}`);

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

    protected abstract transform(evt: IEvent): Either<ErrorEvent, SuccessEvent>;

    start({ filters }: SourceRequest): SourceResponse {

        return from(this.#relayURLs).pipe(
            mergeMap(relayURL => this.#connectToRelay(relayURL).pipe(
                retry({ delay: this.#retryDelay }),
                mergeMap(relay => this.#subscribeToRelay(relay, filters).pipe(
                    takeUntil(this.#stopSignal$),
                    finalize(() => { 
                        this.publishNotification(`Closing connection to ${relay.url}`);
                        relay.close();
                    }),
                )),
                finalize(() => { this.publishError(`Disconnected from ${relayURL}`); }),
                repeat({ delay: this.#retryDelay }),
                takeUntil(this.#stopSignal$),
            )),
            map((evt: IEvent) => this.transform(evt)),
        ) as SourceResponse;
    }
}
