import { IDomainEventData } from "../data/IDomainEventData.js";

export interface IDomainEvent<T extends IDomainEventData> {
    get createdBy(): string;
    get createdOn(): Date;
    get publishedBy(): string|undefined;
    get publishedOn(): Date|undefined;
    get data(): T;

    setPublishedBy(publishedBy: string): void;
    published(): void;
}
