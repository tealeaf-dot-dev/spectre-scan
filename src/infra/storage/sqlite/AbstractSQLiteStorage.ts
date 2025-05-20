import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { ISQL } from './interfaces/ISQL.js';
import { sql } from './sql.js';
import { ISQLiteConfig } from './interfaces/ISQLiteConfig.js';
import { IStoragePort } from '../../../core/scanners/shared/interfaces/IStoragePort.js';

export abstract class AbstractSQLiteStorage<U extends unknown[], T> implements IStoragePort<T> {
    #databasePath: string;
    #database: sqlite3.Database | null = null;
    #createdTables: boolean = false;
    #run: ((sql: string, ...params: unknown[]) => Promise<unknown>) | null = null;
    #sql: ISQL;

    constructor({ databasePath }: ISQLiteConfig) {
        this.#databasePath = databasePath;
        this.#sql = sql;
    }

    get databasePath(): string {

        return this.#databasePath;
    }

    get initialized(): boolean {

        return !!this.#database && !!this.#run && this.#createdTables;
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
        if (!this.#databasePath) throw new Error('Missing database path');

        try {
            await this.#createDatabase(this.#databasePath);

            if (!this.#database) throw new Error('Database not initialized');

            this.#run = promisify(this.#database.run.bind(this.#database));
            await this.#run(this.#sql.createPubkeyTable);
            this.#createdTables = true;
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw error;
            } else {
                throw new Error(`Database initialization error: ${String(error)}`);
            }
        }
    }

    protected async maybeStore(sql: string, params: U): Promise<void> {
        if (!this.initialized) throw new Error('Database not initialized');
        if (!this.#run) throw new Error('Run method does not exist');

        try {
            await this.#run(sql, params);
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw error;
            } else {
                throw new Error(`Failed to store data, error: ${String(error)}`);
            }
        }
    }

    abstract store(params: T): Promise<void>;
}
