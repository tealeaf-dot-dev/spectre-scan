import { filter, Subscription, mergeMap, from, tap } from "rxjs";
import { IEventBusPort } from "../../eventing/ports/event-bus/IEventBusPort.js";
import { IRecorder } from "../generic/IRecorder.js";
import { IPubkeyStoragePort } from "./ports/storage/IPubkeyStoragePort.js";
import { IPubkeyStoragePortResponse } from "./ports/storage/IPubkeyStoragePortResponse.js";
import { isPubkeyFoundEvent } from "./eventing/type-guards/isPubkeyFoundEvent.js";
import { RECORDER_STATUS, RecorderStatus } from "../generic/recorder-status.js";
import { IDomainEvent } from "../../eventing/events/IDomainEvent.js";
import { IDomainEventData } from "../../eventing/data/IDomainEventData.js";
import { bimap } from "fp-ts/lib/Either.js";
import { PubkeyStorageErrorEvent } from "./eventing/events/PubkeyStorageErrorEvent.js";
import { PubkeyStoredEvent } from "./eventing/events/PubkeyStoredEvent.js";
import { Pubkey } from "../../data/types.js";

export class PubkeyRecorder implements IRecorder<IPubkeyStoragePort> {
    readonly #eventBus: IEventBusPort;
    readonly #storages: IPubkeyStoragePort[];
    #subscription?: Subscription;

    constructor(eventBus: IEventBusPort, storages: IPubkeyStoragePort[]) {
        this.#eventBus = eventBus;
        this.#storages = storages;
    }

    publishEvent(evt: IDomainEvent<IDomainEventData>): void {
        evt.setPublishedBy(this.constructor.name);
        this.#eventBus.publish(evt);
    }

    get #stream$(): IPubkeyStoragePortResponse {

        return this.#eventBus.events$.pipe(
            filter(isPubkeyFoundEvent),
            mergeMap(({ pubkey, date }) => this.#storePubkey(pubkey, date)),
            tap(response => {
                bimap(
                    (evt: PubkeyStorageErrorEvent) => { this.publishEvent(evt); },
                    (evt: PubkeyStoredEvent) => { this.publishEvent(evt); },
                )(response);
            }),
        );
    }

    get eventBus(): IEventBusPort {

        return this.#eventBus;
    }

    get storages(): IPubkeyStoragePort[] {

        return this.#storages;
    }

    get status(): RecorderStatus {
        if (!this.#subscription) return RECORDER_STATUS.NeverStarted;
        if (this.#subscription.closed) return RECORDER_STATUS.Stopped;

        return RECORDER_STATUS.Started;
    }

    #storePubkey(pubkey: Pubkey, date: Date): IPubkeyStoragePortResponse {

        return from(this.#storages).pipe(
            mergeMap(storage => this.#storePubkeyInStorage(pubkey, date, storage)),
        );
    }

    #storePubkeyInStorage(pubkey: Pubkey, date: Date, storage: IPubkeyStoragePort): IPubkeyStoragePortResponse {

        return storage.store({ pubkey, date });
    }

    record(): void {
        if (this.status !== RECORDER_STATUS.Started) this.#subscription = this.#stream$.subscribe();
    }

    stop(): void {
        if (this.status === RECORDER_STATUS.Started) this.#subscription?.unsubscribe();
    }
}
