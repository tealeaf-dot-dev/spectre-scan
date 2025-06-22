import { Subscription, Observable } from "rxjs";
import { IEventBusPort } from "../eventing/ports/event-bus/IEventBusPort.js";
import { STREAM_STATUS, StreamStatus } from "./data/stream-status.js";
import { IAbstractStreamProcessor } from "./IAbstractSteamProcessor.js";
import { IDomainEvent } from "../eventing/events/IDomainEvent.js";
import { IDomainEventData } from "../eventing/data/IDomainEventData.js";

export abstract class AbstractStreamProcessor<T extends Observable<unknown>> implements IAbstractStreamProcessor {
    protected readonly _eventBus: IEventBusPort;
    #subscription?: Subscription;

    constructor(eventBus: IEventBusPort) {
        this._eventBus = eventBus;
    }

    protected abstract get stream$(): T;

    get status(): StreamStatus {
        if (!this.#subscription) return STREAM_STATUS.NeverStarted;
        if (this.#subscription.closed) return STREAM_STATUS.Stopped;

        return STREAM_STATUS.Started;
    }

    get eventBus(): IEventBusPort {

        return this._eventBus;
    }

    protected publishEvent(evt: IDomainEvent<IDomainEventData>): void {
        evt.setPublishedBy(this.constructor.name);
        this._eventBus.publish(evt);
    }

    start(): void {
        if (this.status !== STREAM_STATUS.Started) this.#subscription = this.stream$.subscribe();
    }

    stop(): void {
        if (this.status === STREAM_STATUS.Started) this.#subscription?.unsubscribe();
    }
}
