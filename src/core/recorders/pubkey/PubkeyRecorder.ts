import { filter, mergeMap, from, tap } from "rxjs";
import { IEventBusPort } from "../../eventing/ports/event-bus/IEventBusPort.js";
import { IRecorder } from "../generic/IRecorder.js";
import { IPubkeyStoragePort } from "./ports/storage/IPubkeyStoragePort.js";
import { IPubkeyStoragePortResponse } from "./ports/storage/IPubkeyStoragePortResponse.js";
import { isPubkeyFoundEvent } from "./eventing/type-guards/isPubkeyFoundEvent.js";
import { bimap } from "fp-ts/lib/Either.js";
import { PubkeyStorageErrorEvent } from "./eventing/events/PubkeyStorageErrorEvent.js";
import { PubkeyStoredEvent } from "./eventing/events/PubkeyStoredEvent.js";
import { Pubkey } from "../../data/types.js";
import { AbstractStreamProcessor } from "../../stream-processor/AbstractStreamProcessor.js";

export class PubkeyRecorder extends AbstractStreamProcessor<IPubkeyStoragePortResponse> implements IRecorder<IPubkeyStoragePort> {
    readonly #storages: IPubkeyStoragePort[];

    constructor(eventBus: IEventBusPort, storages: IPubkeyStoragePort[]) {
        super(eventBus);
        this.#storages = storages;
    }

    get storages(): IPubkeyStoragePort[] {

        return this.#storages;
    }

    protected get stream$(): IPubkeyStoragePortResponse {

        return this.eventBus.events$.pipe(
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

    #storePubkey(pubkey: Pubkey, date: Date): IPubkeyStoragePortResponse {

        return from(this.#storages).pipe(
            mergeMap(storage => this.#storePubkeyInStorage(pubkey, date, storage)),
        );
    }

    #storePubkeyInStorage(pubkey: Pubkey, date: Date, storage: IPubkeyStoragePort): IPubkeyStoragePortResponse {

        return storage.store({ pubkey, date });
    }
}
