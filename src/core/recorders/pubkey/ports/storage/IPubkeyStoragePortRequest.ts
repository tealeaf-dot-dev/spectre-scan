import { Pubkey } from "../../../../data/types.js";
import { IRecorderStoragePortRequest } from "../../../generic/ports/storage/IRecorderStoragePortRequest.js";
import { type Dayjs } from "dayjs";

export interface IPubkeyStoragePortRequest  extends IRecorderStoragePortRequest {
    pubkey: Pubkey;
    date: Dayjs;
}
