import { Pubkey } from "../../../../data/types.js";
import { IDomainEventData } from "../../../../eventing/data/IDomainEventData.js";
import { type Dayjs } from "dayjs";

export interface IPubkeyEventData extends IDomainEventData {
    pubkey: Pubkey;
    date: Dayjs;
}
