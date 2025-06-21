import { from, mergeMap, tap, Subscription } from "rxjs"; import { IEventBusPort } from "../../eventing/ports/event-bus/IEventBusPort.js";
import { IScanner } from "../generic/IScanner.js";
import { SCANNER_STATUS, ScannerStatus } from "../generic/scanner-status.js";
import { IPubkeyScannerSourcePort } from "./ports/source/IPubkeyScannerSourcePort.js";
import { IPubkeyScannerSourcePortResponse } from "./ports/source/IPubkeyScannerSourcePortResponse.js";
import { bimap } from "fp-ts/lib/Either.js";
import { PubkeyFoundEvent } from "../../recorders/pubkey/eventing/events/PubkeyFoundEvent.js";
import { IDomainEvent } from "../../eventing/events/IDomainEvent.js";
import { IDomainEventData } from "../../eventing/data/IDomainEventData.js";
import { PubkeySourceErrorEvent } from "./eventing/events/PubkeySourceErrorEvent.js";
import { FiltersList } from "../../data/types.js";

export class PubkeyScanner implements IScanner<IPubkeyScannerSourcePort> {
    readonly #eventBus: IEventBusPort;
    readonly #sources: IPubkeyScannerSourcePort[];
    readonly #filters: FiltersList;
    #subscription?: Subscription;

    constructor(eventBus: IEventBusPort, sources: IPubkeyScannerSourcePort[], filters: FiltersList) {
        this.#eventBus = eventBus;
        this.#sources = sources;
        this.#filters = filters;
    }

    get #stream$(): IPubkeyScannerSourcePortResponse {

        return from(this.#sources).pipe(
            mergeMap(source => source.start({ filters: this.#filters })),
            tap((response) => {
                bimap(
                    (evt: PubkeySourceErrorEvent) => { this.#publishEvent(evt); },
                    (evt: PubkeyFoundEvent) => { this.#publishEvent(evt); }
                )(response);
            }),
        );
    }

    get eventBus(): IEventBusPort {

        return this.#eventBus;
    }

    get sources(): IPubkeyScannerSourcePort[] {

        return this.#sources;
    }

    get filters(): FiltersList {

        return this.#filters;
    }

    get status(): ScannerStatus {
        if (!this.#subscription) return SCANNER_STATUS.NeverStarted;
        if (this.#subscription.closed) return SCANNER_STATUS.Stopped;

        return SCANNER_STATUS.Started;
    }

    #publishEvent(evt: IDomainEvent<IDomainEventData>): void {
        evt.setPublishedBy(this.constructor.name);
        this.#eventBus.publish(evt);
    }

    start(): void {
        if (this.status !== SCANNER_STATUS.Started) this.#subscription = this.#stream$.subscribe();
    }

    stop(): void {
        if (this.status === SCANNER_STATUS.Started) this.#subscription?.unsubscribe();
    }
}
