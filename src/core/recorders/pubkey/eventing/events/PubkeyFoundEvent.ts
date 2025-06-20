import { Pubkey } from "../../../../../shared/types.js";
import { AbstractDomainActionEvent } from "../../../../eventing/events/AbstractDomainActionEvent.js";
import { IPubkeyEventData } from "../data/IPubkeyEventData.js";

export class PubkeyFoundEvent extends AbstractDomainActionEvent<IPubkeyEventData> {

    get pubkey(): Pubkey {

        return this.data.pubkey;
    }

    get date(): Date {

        return this.data.date;
    }
}
