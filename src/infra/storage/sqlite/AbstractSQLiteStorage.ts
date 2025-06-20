import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { ISQL } from './interfaces/ISQL.js';
import { sql } from './sql.js';
import { ISQLiteConfig } from './interfaces/ISQLiteConfig.js';
import { IRecorderStoragePort } from '../../../core/recorders/generic/ports/storage/IRecorderStoragePort.js';
import { IEventBusPort } from '../../../core/eventing/ports/event-bus/IEventBusPort.js';
import { stringifyError } from '../../../shared/utils/stringifyError.js';
import { PubkeyStorageErrorEvent } from '../../../core/recorders/pubkey/eventing/events/PubkeyStorageErrorEvent.js';
import { IRecorderStoragePortRequest } from '../../../core/recorders/generic/ports/storage/IRecorderStoragePortRequest.js';
import { IRecorderStoragePortResponse } from '../../../core/recorders/generic/ports/storage/IRecorderStoragePortResponse.js';
import { AbstractDomainErrorEvent } from '../../../core/eventing/events/AbstractDomainErrorEvent.js';
import { AbstractDomainEvent } from '../../../core/eventing/events/AbstractDomainEvent.js';
import { IDomainEventData } from '../../../core/eventing/data/IDomainEventData.js';
import { from, Observable, of, map, catchError } from 'rxjs';
import { Either, left, right } from 'fp-ts/lib/Either.js';

export abstract class AbstractSQLiteStorage<
    SQLParams extends unknown[],
    StorageRequest extends IRecorderStoragePortRequest,
    StorageResponse extends IRecorderStoragePortResponse<AbstractDomainErrorEvent, AbstractDomainEvent<IDomainEventData>>
> implements IRecorderStoragePort<StorageRequest, StorageResponse> {
    #databasePath: string;
    #database: sqlite3.Database | null = null;
    #createdTables: boolean = false;
    #run: ((sql: string, ...params: unknown[]) => Promise<unknown>) | null = null;
    #sql: ISQL;
    protected _eventBus: IEventBusPort;

    constructor({ eventBus, databasePath }: ISQLiteConfig) {
        this._eventBus = eventBus;
        this.#databasePath = databasePath;
        this.#sql = sql;
    }

    get eventBus(): IEventBusPort {

        return this._eventBus;
    }

    get databasePath(): string {

        return this.#databasePath;
    }

    get initialized(): boolean {

        return !!this.#database && !!this.#run && this.#createdTables;
    }

    #publishError(error: string) {
        const evt = new PubkeyStorageErrorEvent(this.constructor.name, { source: this.constructor.name, message: error});
        evt.setPublishedBy(this.constructor.name);
        this.eventBus.publish(evt);
    }

    async #createDatabase(path: string): Promise<void> {

        return new Promise((resolve, reject) => {
            this.#database = new sqlite3.Database(path, function(err) {
                if (err) reject(err);

                resolve();
            });
        });
    }

    async init(): Promise<void> {
        if (!this.#databasePath) {
            this.#publishError('Missing database path');

            return;
        }

        try {
            await this.#createDatabase(this.#databasePath);

            if (!this.#database) {
                this.#publishError('Database not initialized');

                return;
            }

            this.#run = promisify(this.#database.run.bind(this.#database));

            await this.#run(this.#sql.createPubkeyTable);

            this.#createdTables = true;
        } catch (error: unknown) {
            this.#publishError('Database initialization error: ' + stringifyError(error));
        }
    }

    #createError(err: string): Observable<Either<string, SQLParams>> {

        return of(left(err));
    }

    protected maybeStore(sql: string, params: SQLParams): Observable<Either<string, SQLParams>> {
        if (!this.initialized) return this.#createError('Database not initialized');
        if (!this.#run) return this.#createError('Run method does not exist');

        return from(this.#run(sql, params)).pipe(
            map((_: unknown) => right(params)),
            catchError((err: unknown) => of(left<string, SQLParams>('Failed to store data, error: ' + stringifyError(err))))
        );
    }

    abstract store(params: StorageRequest): StorageResponse;
}
