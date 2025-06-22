import { IDomainEventData } from "../../eventing/data/IDomainEventData.js";
import { AbstractDomainActionEvent } from "../../eventing/events/AbstractDomainActionEvent.js";
import { AbstractDomainErrorEvent } from "../../eventing/events/AbstractDomainErrorEvent.js";
import { IAbstractStreamProcessor } from "../../stream-processor/IAbstractSteamProcessor.js";
import { IRecorderStoragePort } from "./ports/storage/IRecorderStoragePort.js";
import { IRecorderStoragePortRequest } from "./ports/storage/IRecorderStoragePortRequest.js";
import { IRecorderStoragePortResponse } from "./ports/storage/IRecorderStoragePortResponse.js";
import { RecorderStatus } from "./recorder-status.js";

export interface IRecorder<
    StoragePort extends IRecorderStoragePort<
        IRecorderStoragePortRequest,
        IRecorderStoragePortResponse<AbstractDomainErrorEvent, AbstractDomainActionEvent<IDomainEventData>>
    >
> extends IAbstractStreamProcessor {
    get storages(): StoragePort[];
    get status(): RecorderStatus;
}
