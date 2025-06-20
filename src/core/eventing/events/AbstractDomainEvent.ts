import { IDomainEventData } from "../data/IDomainEventData.js";
import { IDomainEvent } from "./IDomainEvent.js";

export abstract class AbstractDomainEvent<T extends IDomainEventData> implements IDomainEvent<T> {
    #createdBy: string;
    #createdOn: Date;
    #publishedBy: string|undefined;
    #publishedOn: Date|undefined;
    #data: T;

    constructor(createdBy: string, data: T) {
        this.#data = Object.freeze(data);
        this.#createdBy = createdBy;
        this.#createdOn = new Date();
    }

    get createdBy(): string {

        return this.#createdBy;
    }

    get createdOn(): Date {

        return this.#createdOn;
    }

    get publishedBy(): string|undefined {

        return this.#publishedBy;
    }

    get publishedOn(): Date|undefined {

        return this.#publishedOn;
    }

    get data(): T {

        return this.#data;
    }

    setPublishedBy(publishedBy: string): void {
        if (this.#publishedBy === undefined) {
            this.#publishedBy = publishedBy;
            this.#publishedOn = new Date();
        }
    }

    published(): void {
        if(this.#publishedOn === undefined) this.#publishedOn = new Date();
    }
}
