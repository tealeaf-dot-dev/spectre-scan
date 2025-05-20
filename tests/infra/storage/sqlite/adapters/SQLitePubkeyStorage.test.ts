import { describe, it, expect, vi, beforeEach, afterEach, Mock, MockInstance } from 'vitest';
import { SQLitePubkeyStorage } from '../../../../../src/infra/storage/sqlite/adapters/SQLitePubkeyStorage.js';
import sqlite3 from 'sqlite3';
import { sql } from '../../../../../src/infra/storage/sqlite/sql.js';
import { ISQLiteConfig } from '../../../../../src/infra/storage/sqlite/interfaces/ISQLiteConfig.js';

type DBFactory = (
    filename: string,
    modeOrCb?: number | ((err: Error | null) => void),
    cb?: (err: Error | null) => void,
) => sqlite3.Database;

type RunFn = sqlite3.Database['run'];

vi.mock('sqlite3', () => import('./mocks/sqlite3-mock.js'));

const DB_PATH = '/path/to/database.sql';
const PUBKEY = 'pubkey1';
const TODAY = new Date().toISOString().split('T')[0];
const config: ISQLiteConfig = { databasePath: DB_PATH };

const dbCtor = () => sqlite3.Database as unknown as MockInstance<DBFactory>;
// eslint-disable-next-line @typescript-eslint/unbound-method
const getRunMock = () => dbCtor().mock.instances[0].run as unknown as Mock<RunFn>;

function mockDb(opts: {
    openErr?: Error | null;
    runErrOnCall?: number;
    runErr?: Error;
} = {}) {
    dbCtor().mockImplementationOnce(function (
        this: { run: MockInstance<RunFn> },
        ...args: unknown[]
    ) {
        const cb = args[1] as ((err: Error | null) => void) | undefined;
        let call = 0;

        this.run = vi.fn(
            (_q: string, paramsOrCb?: unknown[] | ((e: Error | null) => void), done?: (e: Error | null) => void) => {
                const next = typeof paramsOrCb === 'function' ? paramsOrCb : done ?? (() => {});

                call++;

                const err = opts.runErrOnCall === call ? opts.runErr ?? new Error('boom') : null;

                process.nextTick(() => { next(err); });

                return this as unknown;
            },
        );

        cb?.(opts.openErr ?? null);

        return this as unknown as sqlite3.Database;
    });
}

describe('SQLitePubkeyStorage', () => {
    afterEach(() => vi.clearAllMocks());

    describe('constructor()', () => {
        it('sets the database path', () => {
            expect(new SQLitePubkeyStorage(config).databasePath).toBe(config.databasePath);
        });
    });

    describe('init()', () => {
        it('creates a database', async () => {
            const storage = new SQLitePubkeyStorage(config);
            await storage.init();

            expect(dbCtor()).toHaveBeenCalledWith(config.databasePath, expect.any(Function));
            expect(storage.initialized).toBe(true);
        });

        it('creates a pubkey table', async () => {
            const storage = new SQLitePubkeyStorage(config);
            await storage.init();

            expect(getRunMock()).toHaveBeenCalledWith(sql.createPubkeyTable, expect.any(Function));
            expect(storage.initialized).toBe(true);
        });

        it('throws when the storage reports a database open error', async () => {
            const boom = new Error('open fail');

            mockDb({ openErr: boom });

            const storage = new SQLitePubkeyStorage(config);

            await expect(storage.init()).rejects.toBe(boom);
            expect(storage.initialized).toBe(false);
        });

        it('throws when the storage reports a table creation error', async () => {
            const boom = new Error('create table fail');

            mockDb({ runErrOnCall: 1, runErr: boom }); // first run() call fails

            const storage = new SQLitePubkeyStorage(config);

            await expect(storage.init()).rejects.toBe(boom);
            expect(storage.initialized).toBe(false);
        });

        it('throws when the database path is empty', async () => {
            const storage = new SQLitePubkeyStorage({ databasePath: '' });

            await expect(storage.init()).rejects.toThrow('Missing database path');
            expect(storage.initialized).toBe(false);
        });
    });

    describe('store()', () => {
        let storage: SQLitePubkeyStorage;

        beforeEach(async () => {
            storage = new SQLitePubkeyStorage(config);
            await storage.init();
        });

        it('stores a pubkey', async () => {
            await storage.store({ pubkey: PUBKEY, date: new Date() });
            expect(getRunMock()).toHaveBeenCalledWith(sql.storePubkey, [PUBKEY, TODAY], expect.any(Function));
        });

        it('throws when the storage is uninitialized', async () => {
            const fresh = new SQLitePubkeyStorage(config);

            await expect(fresh.store({ pubkey: PUBKEY, date: new Date() })).rejects.toThrow('Database not initialized');
        });

        it('throws when the storage reports an error', async () => {
            const boom = new Error('insert fail');

            mockDb({ runErrOnCall: 2, runErr: boom });      // open OK, fail on 2nd run()

            const failing = new SQLitePubkeyStorage(config);

            await failing.init();
            await expect(failing.store({ pubkey: PUBKEY, date: new Date() })).rejects.toBe(boom);
        });
    });
});
