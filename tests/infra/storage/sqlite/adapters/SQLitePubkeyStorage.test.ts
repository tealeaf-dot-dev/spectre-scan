import { describe, it, expect, vi, afterEach, Mock, MockInstance, beforeEach } from 'vitest';
import { SQLitePubkeyStorage } from '../../../../../src/infra/storage/sqlite/adapters/SQLitePubkeyStorage.js';
import sqlite3 from 'sqlite3';
import { ISQLiteConfig } from '../../../../../src/infra/storage/sqlite/interfaces/ISQLiteConfig.js';
import { firstValueFrom, Subject, tap } from 'rxjs';
import { IDomainEvent } from '../../../../../src/core/eventing/events/IDomainEvent.js';
import { IDomainEventData } from '../../../../../src/core/eventing/data/IDomainEventData.js';
import { IEventBusPort } from '../../../../../src/core/eventing/ports/event-bus/IEventBusPort.js';
import { sql } from '../../../../../src/infra/storage/sqlite/sql.js';
import { PubkeyStorageErrorEvent } from '../../../../../src/core/recorders/pubkey/eventing/events/PubkeyStorageErrorEvent.js';
import { map, mapLeft } from "fp-ts/lib/Either.js";
import { PubkeyStoredEvent } from '../../../../../src/core/recorders/pubkey/eventing/events/PubkeyStoredEvent.js';

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

interface IMockDbOpts {
    openErr?: Error | null;
    runErrOnCall?: number;
    runErr?: Error;
}

function mockDb(opts: IMockDbOpts = {}) {
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

afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
});

function createStorage(databasePath = DB_PATH, opts: IMockDbOpts = {}) {
    const eventSubject = new Subject<IDomainEvent<IDomainEventData>>();

    const eventBus: IEventBusPort = {
        events$: eventSubject.asObservable(),
        publish: vi.fn(),
    };

    const config: ISQLiteConfig = { databasePath, eventBus };

    mockDb(opts);

    const storage = new SQLitePubkeyStorage(config);

    return { storage, eventBus, config };
}

describe('SQLitePubkeyStorage', () => {

    describe('constructor()', () => {
        it('initializes properties', () => {
            const dbPath = './path/to/database.sql';
            const { storage, eventBus } = createStorage(dbPath);

            expect(storage.databasePath).toBe(dbPath);
            expect(storage.eventBus).toBe(eventBus);
        });
    });

    describe('init()', () => {
        it('creates a database', async () => {
            const { storage, config } = createStorage();
            await storage.init();

            expect(dbCtor()).toHaveBeenCalledWith(config.databasePath, expect.any(Function));
        });

        it('creates a pubkey table', async () => {
            const { storage } = createStorage();
            await storage.init();

            expect(getRunMock()).toHaveBeenCalledWith(sql.createPubkeyTable, expect.any(Function));
            expect(storage.initialized).toBe(true);
        });

        it('sets initialized to true', async () => {
            const { storage } = createStorage();
            await storage.init();

            expect(storage.initialized).toEqual(true);
        });

        describe('when creating a database fails', () => {
            it('publishes an error', async () => {
                const boom = new Error('open fail');

                mockDb({ openErr: boom });

                const { storage, eventBus } = createStorage();

                await (storage.init());

                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(eventBus.publish).toHaveBeenCalledWith(expect.any(PubkeyStorageErrorEvent));
            });

            it('sets initialized to false', async () => {
                const boom = new Error('open fail');

                mockDb({ openErr: boom });

                const { storage } = createStorage();

                await (storage.init());

                expect(storage.initialized).toBe(false);
            });
        });

        describe('when creating a pubkey table fails', () => {
            it('publishes an error', async () => {
                const boom = new Error('create table fail');

                mockDb({ runErrOnCall: 1, runErr: boom }); // first run() call fails

                const { storage, eventBus } = createStorage();

                await (storage.init());

                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(eventBus.publish).toHaveBeenCalledWith(expect.any(PubkeyStorageErrorEvent));
            });
            it('sets initialized to false', async () => {
                const boom = new Error('create table fail');

                mockDb({ runErrOnCall: 1, runErr: boom }); // first run() call fails

                const { storage } = createStorage();

                await (storage.init());

                expect(storage.initialized).toBe(false);
            });
        });

        describe('when the database path is empty', () => {
            it('publishes an error', async () => {
                const { storage, eventBus } = createStorage('');

                await (storage.init());

                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(eventBus.publish).toHaveBeenCalledWith(expect.any(PubkeyStorageErrorEvent));
            });
            
            it('sets initialized to false', async () => {
                const { storage } = createStorage('');

                await (storage.init());

                expect(storage.initialized).toBe(false);
            });
        });
    });

    describe('store()', () => {
        let storage: SQLitePubkeyStorage;

        beforeEach(async () => {
            const obj = createStorage();
            storage = obj.storage;

            await storage.init();
        });

        it('stores a pubkey', () => {
            storage.store({ pubkey: PUBKEY, date: new Date() });

            expect(getRunMock()).toHaveBeenCalledWith(sql.storePubkey, [PUBKEY, TODAY], expect.any(Function));
        });

        it('returns a success event', async () => {
            expect.assertions(1);

            mockDb();

            const response = storage.store({ pubkey: PUBKEY, date: new Date() });

            await firstValueFrom(
                response.pipe(
                    tap((result) => {
                        map(evt => { expect(evt).toBeInstanceOf(PubkeyStoredEvent); })(result);
                    })
                )
            );
        });

        describe('when the storage is uninitialized', () => {
            it('returns an error event', async () => {
                expect.assertions(1);

                mockDb();

                const uninitializedStorage = createStorage().storage;
                const response = uninitializedStorage.store({ pubkey: PUBKEY, date: new Date() });

                await firstValueFrom(
                    response.pipe(
                        tap((result) => {
                            mapLeft(evt => { expect(evt).toBeInstanceOf(PubkeyStorageErrorEvent); })(result);
                        })
                    )
                );
            });
        });

        describe('when sqlite3 throws an error', () => {
            it('returns an error event', async () => {
                expect.assertions(1);

                const boom = new Error('insert fail');

                mockDb({ runErrOnCall: 2, runErr: boom });      // open OK, fail on 2nd run()

                const { storage: failingStorage } = createStorage();
                await failingStorage.init();

                const response = failingStorage.store({ pubkey: PUBKEY, date: new Date() });

                await firstValueFrom(
                    response.pipe(
                        tap((result) => {
                            mapLeft(evt => { expect(evt).toBeInstanceOf(PubkeyStorageErrorEvent); })(result);
                        })
                    )
                );
            });
        });
    });
});
