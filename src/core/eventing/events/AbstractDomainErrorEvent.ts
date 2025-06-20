import { IDomainErrorEventData } from "../data/IDomainErrorEventData.js";
import { AbstractDomainEvent } from "./AbstractDomainEvent.js";

export abstract class AbstractDomainErrorEvent extends AbstractDomainEvent<IDomainErrorEventData> {

    get source(): string {

        return this.data.source;
    }

    get message(): string {

        return this.data.message;
    }

    get error(): string {

        return `${this.source} error: ${this.message}`;
    }
}
