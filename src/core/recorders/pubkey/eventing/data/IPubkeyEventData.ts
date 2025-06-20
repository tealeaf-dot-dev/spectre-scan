import { Pubkey } from "../../../../../shared/types.js";
import { IDomainEventData } from "../../../../eventing/data/IDomainEventData.js";

export interface IPubkeyEventData extends IDomainEventData {
    pubkey: Pubkey;
    date: Date;
}
