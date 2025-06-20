import { IDomainEventData } from "../data/IDomainEventData.js";
import { AbstractDomainErrorEvent } from "../events/AbstractDomainErrorEvent.js";
import { IDomainEvent } from "../events/IDomainEvent.js";

export function isDomainErrorEvent(evt: IDomainEvent<IDomainEventData>): evt is AbstractDomainErrorEvent {

    return evt instanceof AbstractDomainErrorEvent;
}
