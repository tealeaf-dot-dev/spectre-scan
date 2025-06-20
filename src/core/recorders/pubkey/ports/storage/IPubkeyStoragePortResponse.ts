import { PubkeyStoredEvent } from "../../../../recorders/pubkey/eventing/events/PubkeyStoredEvent.js";
import { IRecorderStoragePortResponse } from "../../../generic/ports/storage/IRecorderStoragePortResponse.js";
import { PubkeyStorageErrorEvent } from "../../eventing/events/PubkeyStorageErrorEvent.js";

export interface IPubkeyStoragePortResponse extends IRecorderStoragePortResponse<PubkeyStorageErrorEvent, PubkeyStoredEvent> {};
