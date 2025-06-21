import { IEvent } from "../../../../shared/interfaces/IEvent.js";
import { AbstractNostrToolsSource } from "../AbstractNostrToolsSource.js";
import { IScannerSourcePort } from "../../../../core/scanners/generic/ports/source/IScannerSourcePort.js";
import { PubkeySourceErrorEvent } from "../../../../core/scanners/pubkey/eventing/events/PubkeySourceErrorEvent.js";
import { PubkeyFoundEvent } from "../../../../core/recorders/pubkey/eventing/events/PubkeyFoundEvent.js";
import { IPubkeyScannerSourcePortRequest } from "../../../../core/scanners/pubkey/ports/source/IPubkeyScannerSourcePortRequest.js";
import { IPubkeyScannerSourcePortResponse } from "../../../../core/scanners/pubkey/ports/source/IPubkeyScannerSourcePortResponse.js";
import { PubkeySourceNotificationEvent } from "../../../../core/scanners/pubkey/eventing/events/PubkeySourceNotificationEvent.js";
import { Either, right } from "fp-ts/lib/Either.js";

export class NostrToolsPubkeySource extends AbstractNostrToolsSource<
    PubkeySourceErrorEvent,
    PubkeyFoundEvent,
    IPubkeyScannerSourcePortRequest,
    IPubkeyScannerSourcePortResponse
> implements IScannerSourcePort<
    IPubkeyScannerSourcePortRequest,
    IPubkeyScannerSourcePortResponse
> {
    protected publishNotification(message: string): void {
        this.publishEvent(
            new PubkeySourceNotificationEvent(this.constructor.name, { source: this.constructor.name, message })
        );
    }

    protected publishError(error: string): void {
        this.publishEvent(
            new PubkeySourceErrorEvent(this.constructor.name, { source: this.constructor.name, message: error})
        );
    }

    protected transform(nostrEvent: IEvent): Either<PubkeySourceErrorEvent, PubkeyFoundEvent> {
        const evt = new PubkeyFoundEvent(this.constructor.name, { pubkey: nostrEvent.pubkey, date: new Date() });

        return right(evt);
    }
}
