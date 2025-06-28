import { IDomainEventData } from "../../../../eventing/data/IDomainEventData.js";
import { IDomainEvent } from "../../../../eventing/events/IDomainEvent.js";
import { PubkeySourceErrorEvent } from "../events/PubkeySourceErrorEvent.js";

export function isPubkeySourceErrorEvent(evt: IDomainEvent<IDomainEventData>): evt is PubkeySourceErrorEvent {

    return evt instanceof PubkeySourceErrorEvent;
}
