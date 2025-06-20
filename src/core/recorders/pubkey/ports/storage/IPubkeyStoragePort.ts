import { IRecorderStoragePort } from "../../../generic/ports/storage/IRecorderStoragePort.js";
import { IPubkeyStoragePortRequest } from "./IPubkeyStoragePortRequest.js";
import { IPubkeyStoragePortResponse } from "./IPubkeyStoragePortResponse.js";

export interface IPubkeyStoragePort extends IRecorderStoragePort<IPubkeyStoragePortRequest, IPubkeyStoragePortResponse> {};
