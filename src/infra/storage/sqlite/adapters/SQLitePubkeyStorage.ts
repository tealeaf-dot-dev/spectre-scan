import { map } from 'rxjs';
import { PubkeyStoredEvent } from "../../../../core/recorders/pubkey/eventing/events/PubkeyStoredEvent.js";
import { IRecorderStoragePort } from "../../../../core/recorders/generic/ports/storage/IRecorderStoragePort.js";
import { IPubkeyStoragePortRequest } from "../../../../core/recorders/pubkey/ports/storage/IPubkeyStoragePortRequest.js";
import { AbstractSQLiteStorage } from "../AbstractSQLiteStorage.js";
import { sql } from "../sql.js";
import { IPubkeyStoragePortResponse } from "../../../../core/recorders/pubkey/ports/storage/IPubkeyStoragePortResponse.js";
import { PubkeyStorageErrorEvent } from '../../../../core/recorders/pubkey/eventing/events/PubkeyStorageErrorEvent.js';
import { bimap, Either } from 'fp-ts/lib/Either.js';
import { Pubkey } from '../../../../core/data/types.js';

type IPubkeyStoragePortSQLParams = [Pubkey, string];

export class SQLitePubkeyStorage extends AbstractSQLiteStorage<
    IPubkeyStoragePortSQLParams,
    IPubkeyStoragePortRequest,
    IPubkeyStoragePortResponse
> implements IRecorderStoragePort<IPubkeyStoragePortRequest, IPubkeyStoragePortResponse> {

    store({ pubkey, date }: IPubkeyStoragePortRequest): IPubkeyStoragePortResponse {
        const dateStr = date.format('YYYY-MM-DD'); // Format dayjs date in YYYY-MM-DD format
        const sqlParams = [pubkey, dateStr] as IPubkeyStoragePortSQLParams;

        return this.maybeStore(sql.storePubkey, sqlParams).pipe(
            map((result: Either<string, IPubkeyStoragePortSQLParams>): Either<PubkeyStorageErrorEvent, PubkeyStoredEvent> => {
                return bimap(
                    (err: string) => new PubkeyStorageErrorEvent(this.constructor.name, { source: this.constructor.name, message: err }),
                    _ => new PubkeyStoredEvent(this.constructor.name, { pubkey, date, storageName: this.constructor.name })
                )(result);
            })
        );
    }
}
