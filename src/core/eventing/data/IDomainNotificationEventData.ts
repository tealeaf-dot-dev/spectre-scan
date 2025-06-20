import { IDomainEventData } from "./IDomainEventData.js";

export interface IDomainNotificationEventData extends IDomainEventData {
    source: string;
    message: string;
}
