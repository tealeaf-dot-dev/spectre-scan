import { IPubkeyStoragePortDTO } from "../../../../core/scanners/pubkey/ports/storage/dto/IPubkeyStoragePortDTO.js";
import { IPubkeyStoragePort } from "../../../../core/scanners/pubkey/ports/storage/IPubkeyStoragePort.js";
import { Pubkey } from "../../../../shared/types.js";
import { AbstractSQLiteStorage } from "../AbstractSQLiteStorage.js";
import { sql } from "../sql.js";

type IPubkeyStoragePortSQLParams = [Pubkey, string];

export class SQLitePubkeyStorage extends AbstractSQLiteStorage<IPubkeyStoragePortSQLParams, IPubkeyStoragePortDTO> implements IPubkeyStoragePort {

    async store({ pubkey, date }: IPubkeyStoragePortDTO) {
        const dateStr = date.toISOString().split('T')[0]; // Current date in YYYY-MM-DD format

        await this.maybeStore(sql.storePubkey, [pubkey, dateStr] as IPubkeyStoragePortSQLParams);
    }
}
