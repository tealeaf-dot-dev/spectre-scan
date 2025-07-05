import { Pubkey } from "../../../../data/types.js";
import { AbstractDomainActionEvent } from "../../../../eventing/events/AbstractDomainActionEvent.js";
import { IPubkeyEventData } from "../data/IPubkeyEventData.js";
import { type Dayjs } from "dayjs";

export class PubkeyFoundEvent extends AbstractDomainActionEvent<IPubkeyEventData> {

    get pubkey(): Pubkey {

        return this.data.pubkey;
    }

    get date(): Dayjs {

        return this.data.date;
    }
}
