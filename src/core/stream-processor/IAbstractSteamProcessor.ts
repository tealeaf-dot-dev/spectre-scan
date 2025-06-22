import { StreamStatus } from "./data/stream-status.js";
import { IAbstractStreamProcessorUserPorts } from "./ports/IAbstractStreamProcessorUserPorts.js";

export interface IAbstractStreamProcessor extends IAbstractStreamProcessorUserPorts {
    get status(): StreamStatus;
}
