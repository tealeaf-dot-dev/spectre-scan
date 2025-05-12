import { describe, it, expect, vi, beforeEach, afterEach, Mock, MockInstance } from 'vitest';
import { SQLiteStorage } from '../../../src/storage/sqlite/SQLiteStorage.js';
import sqlite3 from 'sqlite3';
import { sql } from '../../../src/storage/sqlite/sql.js';

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

describe('SQLiteStorage', () => {
    afterEach(() => vi.clearAllMocks());

    describe('constructor(databasePath)', () => {
        it('sets the database path', () => {
            expect(new SQLiteStorage(DB_PATH).databasePath).toBe(DB_PATH);
        });
    });

    describe('init()', () => {
        it('creates a database', async () => {
            const storage = new SQLiteStorage(DB_PATH);
            await storage.init();

            expect(dbCtor()).toHaveBeenCalledWith(DB_PATH, expect.any(Function));
            expect(storage.initialized).toBe(true);
        });

        it('creates a pubkey table', async () => {
            const storage = new SQLiteStorage(DB_PATH);
            await storage.init();

            expect(getRunMock()).toHaveBeenCalledWith(sql.createPubkeyTable, expect.any(Function));
            expect(storage.initialized).toBe(true);
        });

        it('throws when the storage reports a database open error', async () => {
            const boom = new Error('open fail');

            mockDb({ openErr: boom });

            const storage = new SQLiteStorage(DB_PATH);

            await expect(storage.init()).rejects.toBe(boom);
            expect(storage.initialized).toBe(false);
        });

        it('throws when the storage reports a table creation error', async () => {
            const boom = new Error('create table fail');

            mockDb({ runErrOnCall: 1, openErr: boom }); // first run() call fails

            const storage = new SQLiteStorage(DB_PATH);

            await expect(storage.init()).rejects.toBe(boom);
            expect(storage.initialized).toBe(false);
        });

        it('throws when the database path is empty', async () => {
            const storage = new SQLiteStorage('');

            await expect(storage.init()).rejects.toThrow('Missing database path');
            expect(storage.initialized).toBe(false);
        });
    });

    describe('storePubkey(pubkey)', () => {
        let storage: SQLiteStorage;

        beforeEach(async () => {
            storage = new SQLiteStorage(DB_PATH);
            await storage.init();
        });

        it('stores a pubkey', async () => {
            await storage.storePubkey(PUBKEY, new Date());
            expect(getRunMock()).toHaveBeenCalledWith(sql.storePubkey, [PUBKEY, TODAY], expect.any(Function));
        });

        it('throws when the storage is uninitialized', async () => {
            const fresh = new SQLiteStorage(DB_PATH);

            await expect(fresh.storePubkey(PUBKEY, new Date())).rejects.toThrow('Database not initialized');
        });

        it('throws when the storage reports an error', async () => {
            const boom = new Error('insert fail');

            mockDb({ runErrOnCall: 2, runErr: boom });      // open OK, fail on 2nd run()

            const failing = new SQLiteStorage(DB_PATH);

            await failing.init();
            await expect(failing.storePubkey(PUBKEY, new Date())).rejects.toBe(boom);
        });
    });
});
