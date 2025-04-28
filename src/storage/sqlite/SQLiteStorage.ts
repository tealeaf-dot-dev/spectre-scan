import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { IPubkeyStoragePort } from "../../core/pubkey-scanner/ports/storage/IPubkeyStoragePort.js";
import { Pubkey } from '../../shared/types.js';
import { ISQL } from './interfaces/ISQL.js';
import { sql } from './sql.js';

export class SQLiteStorage implements IPubkeyStoragePort {
    #databasePath: string;
    #database: sqlite3.Database | null = null;
    #initialized: boolean = false;
    #run: ((sql: string, ...params: unknown[]) => Promise<unknown>) | null = null;
    #sql: ISQL;

    constructor(databasePath: string) {
        this.#databasePath = databasePath;
        this.#sql = sql;
    }

    get databasePath(): string {

        return this.#databasePath;
    }

    get initialized(): boolean {

        return this.#initialized;
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
            this.#initialized = true;
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw error;
            } else {
                throw new Error(`Database initialization error: ${String(error)}`);
            }
        }
    }

    async storePubkey(pubkey: Pubkey, date: Date): Promise<void> {
        if (!this.#database) throw new Error('Database not initialized');
        if (!this.#run) throw new Error('Run method does not exist');

        const dateStr = date.toISOString().split('T')[0]; // Current date in YYYY-MM-DD format

        try {
            await this.#run(this.#sql.storePubkey, [pubkey, dateStr]);
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw error;
            } else {
                throw new Error(`Failed to add pubkey: ${String(error)}`);
            }
        }
    }
}
