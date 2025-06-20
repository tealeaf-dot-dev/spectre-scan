import { Pubkey } from "../../../../../shared/types.js";
import { AbstractDomainActionEvent } from "../../../../eventing/events/AbstractDomainActionEvent.js";
import { IPubkeyStoredEventData } from "../data/IPubkeyStoredEventData.js";

export class PubkeyStoredEvent extends AbstractDomainActionEvent<IPubkeyStoredEventData> {

    get pubkey(): Pubkey {

        return this.data.pubkey;
    }

    get date(): Date {

        return this.data.date;
    }

    get storageName(): string {

        return this.data.storageName;
    }
}
