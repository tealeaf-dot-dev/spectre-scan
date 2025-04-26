import { Relay } from 'nostr-tools';
import { useWebSocketImplementation } from 'nostr-tools/relay';
import WebSocket from 'ws';
import sqlite3 from 'sqlite3';
import { from, mergeMap, repeat, retry, map, defer, finalize, Observable, Subscriber } from 'rxjs';
import { promisify } from 'util';

interface Filter {
    ids?: string[];
    kinds?: number[];
    authors?: string[];
    since?: number;
    until?: number;
    limit?: number;
    search?: string;
    [key: `#${string}`]: string[] | undefined;
}

declare const verifiedSymbol: unique symbol;

interface Event {
    kind: number;
    tags: string[][];
    content: string;
    created_at: number;
    pubkey: string;
    id: string;
    sig: string;
    [verifiedSymbol]?: boolean;
}

type RelayURL = string;
type Pubkey = string;
type RelayURLList = RelayURL[];
type FiltersList = Filter[];

type SQLiteConfig = {
    databasePath: string,
    SQL: {
        [key: string]: string,
    },
}

type Config = {
    relayURLs: RelayURLList,
    filters: FiltersList,
}

interface IStorage {
    init(): Promise<void>,
    initialized(): boolean,
    storePubkey(pubkey: Pubkey, date: Date): void,
}

interface IRelayScanner {
    scan(relayURLs: RelayURLList, filters: FiltersList): Observable<Pubkey> 
}

interface ISpectreScan {
    run(relayURLs: RelayURLList, filters: FiltersList): Promise<void>,
}

const config: Config = {
    relayURLs: [
        'wss://relay.damus.io',
        'wss://nostr-pub.wellorder.net',
        'wss://nos.lol',
        'wss://relay.snort.social',
        'wss://relay.nostr.bg',
        'wss://offchain.pub',
        'wss://relay.nostr.band/all',
    ],
    filters: [
        { kinds: [1] },
    ]
}

useWebSocketImplementation(WebSocket);

class SQLiteStorage implements IStorage {
    #database: sqlite3.Database | null = null;
    #initialized: boolean = false;
    #run: ((sql: string, ...params: any[]) => Promise<unknown>) | null = null;

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
                if (err) return reject(err);

                resolve();
            });
        });
    }

    async init(): Promise<void> {
        try {
            await this.#createDatabase(SQLiteStorage.#config.databasePath);
            this.#run = promisify(this.#database!.run.bind(this.#database));
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

    storePubkey(pubkey: Pubkey, date: Date): void {
        if (!this.#database) throw new Error('Database not initialized');

        const dateStr = date.toISOString().split('T')[0]; // Current date in YYYY-MM-DD format

        try {
            this.#run!(SQLiteStorage.#config.SQL.storePubkey, [pubkey, dateStr]);
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

class NostrToolsRelayScanner implements IRelayScanner {
    static #connectToRelay(relayURL: RelayURL): Observable<Relay> {

        return defer((): Observable<Relay> => {
            console.log(`Connecting to ${relayURL}`);

            return from(Relay.connect(relayURL).then((relay) => {
                console.log(`Connected to ${relayURL}`);

                return relay;
            }).catch((error: unknown) => {
                console.log(`Failed to connect to ${relayURL}: ${error instanceof Error ? error.message : String(error)}`);

                if (error instanceof Error) {
                    throw error;
                } else {
                    throw new Error(`Connection error: ${String(error)}`);
                }
            }));
        });
    }

    static #subscribeToRelay(relay: Relay, filters: FiltersList): Observable<Event> {

        return new Observable<Event>((subscriber: Subscriber<Event>) => {
            const subscription = relay.subscribe(filters, {
                onevent(event: Event) {
                    subscriber.next(event);
                },
                onclose() {
                    subscriber.complete();
                },
            });

            return () => subscription.close();
        });
    }

    scan(relayURLs: RelayURLList, filters: FiltersList): Observable<Pubkey> {

        return from(relayURLs).pipe(
            mergeMap(relayURL => NostrToolsRelayScanner.#connectToRelay(relayURL).pipe(
                retry({ delay: 60000 }),
                mergeMap(relay => NostrToolsRelayScanner.#subscribeToRelay(relay, filters)),
                finalize(() => console.log(`Disconnected from ${relayURL}`)),
                repeat({ delay: 60000 }),
            )),
            map(event => event.pubkey),
        );
    }
}

class SpectreScan implements ISpectreScan {
    #relayScanner: IRelayScanner;
    #storage: IStorage;

    #maybeStorePubkey(pubkey: Pubkey): void {
        try {
            this.#storage.storePubkey(pubkey, new Date());
        } catch (error: unknown) {
            console.error(`Error storing pubkey ${pubkey}: ${
                error instanceof Error ? error.message : String(error)
            }`);
        }
    }

    static #logSubscriptionError(error: unknown): void {
        console.error(`Subscription error: ${
            error instanceof Error ? error.message : String(error)
        }`);
    }

    constructor(relayScanner: IRelayScanner, storage: IStorage) {
        this.#relayScanner = relayScanner;
        this.#storage = storage;
    }

    async run(relayURLs: RelayURLList, filters: FiltersList) {
        try {
            await this.#storage.init();

            this.#relayScanner
                .scan(relayURLs, filters)
                .subscribe({
                    next: (pubkey) => this.#maybeStorePubkey(pubkey),
                    error: SpectreScan.#logSubscriptionError,
                });
        } catch (error: unknown) {
            console.error(`Failed to initialize: ${
                error instanceof Error ? error.message : String(error)
            }`);
        }
    }
}

const spectreScan = new SpectreScan(new NostrToolsRelayScanner(), new SQLiteStorage());
spectreScan.run(config.relayURLs, config.filters);
