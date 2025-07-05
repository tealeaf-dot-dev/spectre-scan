import { IDomainEventData } from "../data/IDomainEventData.js";
import { IDomainEvent } from "./IDomainEvent.js";
import dayjs, { type Dayjs } from "dayjs";

export abstract class AbstractDomainEvent<T extends IDomainEventData> implements IDomainEvent<T> {
    #createdBy: string;
    #createdOn: Dayjs;
    #publishedBy: string|undefined;
    #publishedOn: Dayjs|undefined;
    #data: T;

    constructor(createdBy: string, data: T) {
        this.#data = Object.freeze(data);
        this.#createdBy = createdBy;
        this.#createdOn = dayjs();
    }

    get createdBy(): string {

        return this.#createdBy;
    }

    get createdOn(): Dayjs {

        return this.#createdOn;
    }

    get publishedBy(): string|undefined {

        return this.#publishedBy;
    }

    get publishedOn(): Dayjs|undefined {

        return this.#publishedOn;
    }

    get data(): T {

        return this.#data;
    }

    setPublishedBy(publishedBy: string): void {
        if (this.#publishedBy === undefined) {
            this.#publishedBy = publishedBy;
            this.#publishedOn = dayjs();
        }
    }

    published(): void {
        if(this.#publishedOn === undefined) this.#publishedOn = dayjs();
    }
}
