import { IDomainEventData } from "../../../../eventing/data/IDomainEventData.js";
import { AbstractDomainErrorEvent } from "../../../../eventing/events/AbstractDomainErrorEvent.js";
import { AbstractDomainEvent } from "../../../../eventing/events/AbstractDomainEvent.js";
import { IRecorderStoragePortRequest } from "./IRecorderStoragePortRequest.js";
import { IRecorderStoragePortResponse } from "./IRecorderStoragePortResponse.js";

export interface IRecorderStoragePort<
    StorageRequest extends IRecorderStoragePortRequest,
    StorageResponse extends IRecorderStoragePortResponse<AbstractDomainErrorEvent, AbstractDomainEvent<IDomainEventData>>
> {
    store(params: StorageRequest): StorageResponse,
}
