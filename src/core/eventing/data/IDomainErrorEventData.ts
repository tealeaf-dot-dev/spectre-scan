import { IDomainEventData } from "./IDomainEventData.js";

export interface IDomainErrorEventData extends IDomainEventData {
    source: string;
    message: string;
}
