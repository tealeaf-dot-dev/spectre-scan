import { IPubkeyScannerPort } from "../../../../core/scanners/pubkey/ports/nostr/IRelayScannerPort.js";
import { Pubkey } from "../../../../shared/types.js";
import { IEvent } from "../../../../shared/interfaces/IEvent.js";
import { AbstractNostrToolsRelayScanner } from "../AbstractNostrToolsRelayScanner.js";

export class NostrToolsPubkeySource extends AbstractNostrToolsRelayScanner<Pubkey> implements IPubkeyScannerPort {

    protected transform(evt: IEvent): Pubkey {

        return evt.pubkey;
    }
}
