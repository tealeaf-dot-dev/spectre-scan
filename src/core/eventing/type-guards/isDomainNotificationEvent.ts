import { IDomainEventData } from "../data/IDomainEventData.js";
import { AbstractDomainNotificationEvent } from "../events/AbstractDomainNotificationEvent.js";
import { IDomainEvent } from "../events/IDomainEvent.js";

export function isDomainNotificationEvent(evt: IDomainEvent<IDomainEventData>): evt is AbstractDomainNotificationEvent {

    return evt instanceof AbstractDomainNotificationEvent;
}
