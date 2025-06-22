import { from, mergeMap, tap } from "rxjs"; import { IEventBusPort } from "../../eventing/ports/event-bus/IEventBusPort.js";
import { bimap, Either } from "fp-ts/lib/Either.js";
import { IScanner } from "../generic/IScanner.js";
import { IPubkeyScannerSourcePort } from "./ports/source/IPubkeyScannerSourcePort.js";
import { IPubkeyScannerSourcePortResponse } from "./ports/source/IPubkeyScannerSourcePortResponse.js";
import { AbstractStreamProcessor } from "../../stream-processor/AbstractStreamProcessor.js";
import { PubkeyFoundEvent } from "../../recorders/pubkey/eventing/events/PubkeyFoundEvent.js";
import { FiltersList } from "../../data/types.js";
import { PubkeySourceErrorEvent } from "./eventing/events/PubkeySourceErrorEvent.js";

export class PubkeyScanner extends AbstractStreamProcessor<IPubkeyScannerSourcePortResponse> implements IScanner<IPubkeyScannerSourcePort> {
    readonly #sources: IPubkeyScannerSourcePort[];
    readonly #filters: FiltersList;

    constructor(eventBus: IEventBusPort, sources: IPubkeyScannerSourcePort[], filters: FiltersList) {
        super(eventBus);
        this.#sources = sources;
        this.#filters = filters;
    }

    get sources(): IPubkeyScannerSourcePort[] {

        return this.#sources;
    }

    get filters(): FiltersList {

        return this.#filters;
    }

    protected get stream$(): IPubkeyScannerSourcePortResponse {

        return from(this.#sources).pipe(
            mergeMap(source => source.start({ filters: this.#filters })),
            tap(this.#publishResponse.bind(this)),
        );
    }

    #publishResponse(response: Either<PubkeySourceErrorEvent, PubkeyFoundEvent>): void {
        bimap(
            (evt: PubkeySourceErrorEvent) => { this.publishEvent(evt); },
            (evt: PubkeyFoundEvent) => { this.publishEvent(evt); }
        )(response);
    }
}
