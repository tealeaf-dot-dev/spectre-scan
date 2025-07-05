import { Pubkey } from "../../../../data/types.js";
import { AbstractDomainActionEvent } from "../../../../eventing/events/AbstractDomainActionEvent.js";
import { IPubkeyStoredEventData } from "../data/IPubkeyStoredEventData.js";
import { type Dayjs } from "dayjs";

export class PubkeyStoredEvent extends AbstractDomainActionEvent<IPubkeyStoredEventData> {

    get pubkey(): Pubkey {

        return this.data.pubkey;
    }

    get date(): Dayjs {

        return this.data.date;
    }

    get storageName(): string {

        return this.data.storageName;
    }
}
