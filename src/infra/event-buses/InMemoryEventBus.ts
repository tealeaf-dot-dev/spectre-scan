import { Observable, ReplaySubject } from "rxjs";
import { IEventBusPort } from "../../core/eventing/ports/event-bus/IEventBusPort.js";
import { IDomainEvent } from "../../core/eventing/events/IDomainEvent.js";
import { IDomainEventData } from "../../core/eventing/data/IDomainEventData.js";

export class InMemoryEventBus implements IEventBusPort {
    static #bus: InMemoryEventBus | null = null;
    #subject = new ReplaySubject<IDomainEvent<IDomainEventData>>(10000, 10000);

    private constructor() {}

    static create(): InMemoryEventBus {

        return this.#bus ??= new InMemoryEventBus();
    }

    get events$(): Observable<IDomainEvent<IDomainEventData>> {

        return this.#subject.asObservable();
    }

    publish(e: IDomainEvent<IDomainEventData>): void {
        e.published();
        this.#subject.next(e);
    }
}
