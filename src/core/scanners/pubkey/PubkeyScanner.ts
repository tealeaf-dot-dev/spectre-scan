import { FiltersList } from "../../../shared/types.js";
import { from, mergeMap, tap, Subscription } from "rxjs"; import { IEventBusPort } from "../../eventing/ports/event-bus/IEventBusPort.js";
import { IScanner } from "../generic/IScanner.js";
import { SCANNER_STATUS, ScannerStatus } from "../generic/scanner-status.js";
import { IPubkeyScannerSourcePort } from "./ports/source/IPubkeyScannerSourcePort.js";
import { IPubkeyScannerSourcePortResponse } from "./ports/source/IPubkeyScannerSourcePortResponse.js";

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
                response.value.setPublishedBy(this.constructor.name); 
                this.#eventBus.publish(response.value);
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

    start(): void {
        if (this.status !== SCANNER_STATUS.Started) this.#subscription = this.#stream$.subscribe();
    }

    stop(): void {
        if (this.status === SCANNER_STATUS.Started) this.#subscription?.unsubscribe();
    }
}
