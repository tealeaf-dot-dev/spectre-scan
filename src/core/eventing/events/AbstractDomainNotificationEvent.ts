import { IDomainNotificationEventData } from "../data/IDomainNotificationEventData.js";
import { AbstractDomainEvent } from "./AbstractDomainEvent.js";

export abstract class AbstractDomainNotificationEvent extends AbstractDomainEvent<IDomainNotificationEventData> {

    get source(): string {

        return this.data.source;
    }

    get message(): string {

        return this.data.message;
    }

    get notification(): string {

        return `${this.source} notification: ${this.message}`;
    }
}
