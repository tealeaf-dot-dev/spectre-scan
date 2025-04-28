import { Pubkey } from "../../../../shared/types.js";

export interface IPubkeyStoragePort {
    init(): Promise<void>,
    initialized: boolean,
    storePubkey(pubkey: Pubkey, date: Date): Promise<void>,
}
