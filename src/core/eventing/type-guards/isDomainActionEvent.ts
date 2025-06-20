import { IDomainEventData } from "../data/IDomainEventData.js";
import { AbstractDomainActionEvent } from "../events/AbstractDomainActionEvent.js";
import { IDomainEvent } from "../events/IDomainEvent.js";

export function isDomainActionEvent(evt: IDomainEvent<IDomainEventData>): evt is AbstractDomainActionEvent<IDomainEventData> {

    return evt instanceof AbstractDomainActionEvent;
}
