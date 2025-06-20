import { IDomainEventData } from "../../eventing/data/IDomainEventData.js";
import { AbstractDomainActionEvent } from "../../eventing/events/AbstractDomainActionEvent.js";
import { AbstractDomainErrorEvent } from "../../eventing/events/AbstractDomainErrorEvent.js";
import { IEventBusPort } from "../../eventing/ports/event-bus/IEventBusPort.js";
import { IRecorderStoragePort } from "./ports/storage/IRecorderStoragePort.js";
import { IRecorderStoragePortRequest } from "./ports/storage/IRecorderStoragePortRequest.js";
import { IRecorderStoragePortResponse } from "./ports/storage/IRecorderStoragePortResponse.js";
import { IRecorderUserPorts } from "./ports/user/IRecorderUserPorts.js";
import { RecorderStatus } from "./recorder-status.js";

export interface IRecorder<
    StoragePort extends IRecorderStoragePort<
        IRecorderStoragePortRequest,
        IRecorderStoragePortResponse<AbstractDomainErrorEvent, AbstractDomainActionEvent<IDomainEventData>>
    >
> extends IRecorderUserPorts {
    get eventBus(): IEventBusPort;
    get storages(): StoragePort[];
    get status(): RecorderStatus;
}
