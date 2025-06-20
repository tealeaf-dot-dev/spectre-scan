import { Observable } from "rxjs";
import { IDomainEvent } from "../../events/IDomainEvent.js";
import { IDomainEventData } from "../../data/IDomainEventData.js";

export interface IEventBusPort {
    publish(e: IDomainEvent<IDomainEventData>): void;
    events$: Observable<IDomainEvent<IDomainEventData>>;
}
