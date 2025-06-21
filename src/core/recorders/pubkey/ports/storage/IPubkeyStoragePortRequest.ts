import { Pubkey } from "../../../../data/types.js";
import { IRecorderStoragePortRequest } from "../../../generic/ports/storage/IRecorderStoragePortRequest.js";

export interface IPubkeyStoragePortRequest  extends IRecorderStoragePortRequest {
    pubkey: Pubkey;
    date: Date;
}
