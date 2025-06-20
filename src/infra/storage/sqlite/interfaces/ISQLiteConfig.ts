import { IEventBusPort } from "../../../../core/eventing/ports/event-bus/IEventBusPort.js";

export interface ISQLiteConfig {
    eventBus: IEventBusPort;
    databasePath: string;
}
