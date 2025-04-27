import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { IPubkeyStoragePort } from "../../core/scanner/ports/storage/IPubkeyStoragePort.js";
import { Pubkey } from '../../shared/types.js';
import { SQLiteConfig } from './types.js';

export class SQLiteStorage implements IPubkeyStoragePort {
    #database: sqlite3.Database | null = null;
    #initialized: boolean = false;
    #run: ((sql: string, ...params: unknown[]) => Promise<unknown>) | null = null;

    static readonly #config: SQLiteConfig = {
        databasePath: './data/nostr_data.db',
        SQL: {
            createPubkeyTable: `CREATE TABLE IF NOT EXISTS pubkeys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pubkey TEXT,
                date DATE,
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(pubkey, date))
                `,
            storePubkey: 'INSERT OR IGNORE INTO pubkeys (pubkey, date) VALUES (?, ?)',
        },
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
        try {
            await this.#createDatabase(SQLiteStorage.#config.databasePath);

            if (!this.#database) throw new Error('Database not initialized');

            this.#run = promisify(this.#database.run.bind(this.#database));
            await this.#run(SQLiteStorage.#config.SQL.createPubkeyTable);
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
        if (!this.#run) throw new Error('Blah');

        const dateStr = date.toISOString().split('T')[0]; // Current date in YYYY-MM-DD format

        try {
            await this.#run(SQLiteStorage.#config.SQL.storePubkey, [pubkey, dateStr]);
        } catch (error: unknown) {
            if (error instanceof Error) {
                throw error;
            } else {
                throw new Error(`Failed to add pubkey: ${String(error)}`);
            }
        }
    }

    initialized(): boolean {

        return this.#initialized;
    }
}
