import { IDomainEventData } from "../../../../eventing/data/IDomainEventData.js";
import { IDomainEvent } from "../../../../eventing/events/IDomainEvent.js";
import { PubkeyFoundEvent } from "../events/PubkeyFoundEvent.js";

export function isPubkeyFoundEvent(evt: IDomainEvent<IDomainEventData>): evt is PubkeyFoundEvent {

    return evt instanceof PubkeyFoundEvent;
}
