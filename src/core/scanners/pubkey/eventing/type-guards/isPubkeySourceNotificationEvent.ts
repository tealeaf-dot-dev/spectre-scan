import { IDomainEventData } from "../../../../eventing/data/IDomainEventData.js";
import { IDomainEvent } from "../../../../eventing/events/IDomainEvent.js";
import { PubkeySourceNotificationEvent } from "../events/PubkeySourceNotificationEvent.js";

export function isPubkeySourceNotificationEvent(evt: IDomainEvent<IDomainEventData>): evt is PubkeySourceNotificationEvent {

    return evt instanceof PubkeySourceNotificationEvent;
}
