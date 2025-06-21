import { IEventBusPort } from "../../../../core/eventing/ports/event-bus/IEventBusPort.js";
import { RelayURLList } from "../../data/types.js";

export interface INostrToolsSourceConfig {
    eventBus: IEventBusPort;
    relayURLs: RelayURLList,
    retryDelay?: number,
}
