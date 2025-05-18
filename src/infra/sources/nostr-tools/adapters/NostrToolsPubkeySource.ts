import { IPubkeySourcePort } from "../../../../core/scanners/pubkey/ports/nostr/IPubkeySourcePort.js";
import { Pubkey } from "../../../../shared/types.js";
import { IEvent } from "../../../../shared/interfaces/IEvent.js";
import { AbstractNostrToolsSource } from "../AbstractNostrToolsSource.js";

export class NostrToolsPubkeySource extends AbstractNostrToolsSource<Pubkey> implements IPubkeySourcePort {

    protected transform(evt: IEvent): Pubkey {

        return evt.pubkey;
    }
}
