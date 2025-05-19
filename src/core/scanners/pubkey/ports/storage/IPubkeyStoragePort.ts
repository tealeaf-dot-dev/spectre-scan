import { Pubkey } from "../../../../../shared/types.js";

export interface IPubkeyStoragePort {
    storePubkey(pubkey: Pubkey, date: Date): Promise<void>,
}
