import { IDomainEventData } from "../data/IDomainEventData.js";
import { AbstractDomainEvent } from "./AbstractDomainEvent.js";

export abstract class AbstractDomainActionEvent<T extends IDomainEventData> extends AbstractDomainEvent<T> {};
