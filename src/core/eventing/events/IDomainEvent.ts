import { IDomainEventData } from "../data/IDomainEventData.js";
import { type Dayjs } from "dayjs";

export interface IDomainEvent<T extends IDomainEventData> {
    get createdBy(): string;
    get createdOn(): Dayjs;
    get publishedBy(): string|undefined;
    get publishedOn(): Dayjs|undefined;
    get data(): T;

    setPublishedBy(publishedBy: string): void;
    published(): void;
}
