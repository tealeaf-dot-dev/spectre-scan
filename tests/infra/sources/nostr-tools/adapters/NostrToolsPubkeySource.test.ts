import { describe, it, expect, vi, afterEach } from "vitest";
import { mock } from 'vitest-mock-extended';
import { Relay, Filter } from "nostr-tools";
import { WebSocketServer } from "ws";
import { firstValueFrom, take, toArray, Subscription } from "rxjs";
import { NostrToolsPubkeySource } from "../../../../../src/infra/sources/nostr-tools/adapters/NostrToolsPubkeySource.js";
import { IEvent } from "../../../../../src/core/data/IEvent.js";
import { IEventBusPort } from "../../../../../src/core/eventing/ports/event-bus/IEventBusPort.js";
import { PubkeySourceNotificationEvent } from "../../../../../src/core/scanners/pubkey/eventing/events/PubkeySourceNotificationEvent.js";
import { PubkeySourceErrorEvent } from "../../../../../src/core/scanners/pubkey/eventing/events/PubkeySourceErrorEvent.js";
import { PubkeyFoundEvent } from "../../../../../src/core/recorders/pubkey/eventing/events/PubkeyFoundEvent.js";
import { bimap, isRight, map, right, sequenceArray } from "fp-ts/lib/Either.js";

type SubscriptionCallbacks = {
    onevent?: (event: IEvent) => void;
    onclose?: () => void;
};

let subscription: Subscription;

afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
});

describe('NostrToolsPubkeySource', () => {
    describe('constructor()', () => {
        it('initializes properties', () => {
            const RELAY_URLS = ['wss://relay1.com', 'wss://relay2.com'];
            const eventBus = mock<IEventBusPort>();
            const retryDelay = 1234;

            const source = new NostrToolsPubkeySource({ eventBus, retryDelay, relayURLs: RELAY_URLS });

            expect(source.eventBus).toStrictEqual(eventBus);
            expect(source.relayURLs).toStrictEqual(RELAY_URLS);
            expect(source.retryDelay).toStrictEqual(retryDelay);
        });
    });
    
    describe('start()', () => {
        afterEach(async () => {
            subscription.unsubscribe();
            await Promise.resolve();
        });

        it('connects to relays', async () => {
            const RELAY_URLS = ['wss://relay1.com', 'wss://relay2.com'];
            const mockSubscription = { close: vi.fn() };

            const mockRelay = {
                subscribe: vi.fn(() => mockSubscription),
                close: vi.fn(),
            } as unknown as Relay;

            const eventBus = mock<IEventBusPort>();
            const connectSpy = vi.spyOn(Relay, 'connect')
                .mockImplementation(() => Promise.resolve(mockRelay));
            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: RELAY_URLS });
            subscription = source.start({ filters: [] }).subscribe();

            await Promise.resolve();

            expect(connectSpy).toHaveBeenCalledTimes(RELAY_URLS.length);

            RELAY_URLS.forEach(url => {
                expect(connectSpy).toHaveBeenCalledWith(url);
            });

            source.stop();
        });

        it('receives events from relays and returns their pubkeys', async () => {
            const RELAY_URLS = ['wss://relay1.com', 'wss://relay2.com'];
            const PUBKEYS_FROM_RELAY1 = ['pubkey1', 'pubkey2'];
            const PUBKEYS_FROM_RELAY2 = ['pubkey3'];
            const eventBus = mock<IEventBusPort>();

            const eventsRelay1 = PUBKEYS_FROM_RELAY1.map(
                pk => ({ pubkey: pk } as unknown as IEvent),
            );

            const eventsRelay2 = PUBKEYS_FROM_RELAY2.map(
                pk => ({ pubkey: pk } as unknown as IEvent),
            );

            const mockRelay1 = {
                url: RELAY_URLS[0],
                subscribe: vi.fn((_filters: Filter[], { onevent, onclose }: SubscriptionCallbacks) => {
                    eventsRelay1.forEach(evt => { onevent?.(evt); });
                    onclose?.();

                    return { close: vi.fn() };
                }),
            } as unknown as Relay;

            const mockRelay2 = {
                url: RELAY_URLS[1],
                subscribe: vi.fn((_filters: Filter[], { onevent, onclose }: SubscriptionCallbacks) => {
                    eventsRelay2.forEach(evt => { onevent?.(evt); });
                    onclose?.();

                    return { close: vi.fn() };
                }),
            } as unknown as Relay;

            vi.spyOn(Relay, 'connect').mockImplementation((url: string) => {
                if (url === RELAY_URLS[0]) return Promise.resolve(mockRelay1);
                if (url === RELAY_URLS[1]) return Promise.resolve(mockRelay2);

                throw new Error(`Unexpected relay url ${url}`);
            });

            const totalEvents = PUBKEYS_FROM_RELAY1.length + PUBKEYS_FROM_RELAY2.length;
            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: RELAY_URLS });

            const results = await firstValueFrom(
                source.start({ filters: [] }).pipe(take(totalEvents), toArray()),
            );

            expect(results).toHaveLength(totalEvents);

            results.forEach(evt => {
                expect(isRight(evt)).toEqual(true);
                bimap(
                    (evt: PubkeySourceErrorEvent) => { expect(evt).toBeInstanceOf(PubkeyFoundEvent); },
                    (evt: PubkeyFoundEvent) => { expect(evt).toBeInstanceOf(PubkeyFoundEvent); },
                )(evt);
            });

            const foundPubkeys = sequenceArray(
                results.map(
                    result => map((evt: PubkeyFoundEvent) => evt.data.pubkey)(result)
                ).sort()
            );

            expect(foundPubkeys).toStrictEqual(right(
                [...PUBKEYS_FROM_RELAY1, ...PUBKEYS_FROM_RELAY2].sort()
            ));

            source.stop();
        });

        it('publishes a notification when connecting to a relay', async () => {
            const RELAY_URLS = ['wss://relay1.com'];
            const mockSubscription = { close: vi.fn() };
            const mockRelay = {
                url: RELAY_URLS[0],
                subscribe: vi.fn(() => mockSubscription),
                close: vi.fn(),
            } as unknown as Relay;

            const eventBus = mock<IEventBusPort>();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            const publishSpy = eventBus.publish;

            vi.spyOn(Relay, 'connect').mockImplementation(() => Promise.resolve(mockRelay));

            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: RELAY_URLS });
            subscription = source.start({ filters: [] }).subscribe();

            await Promise.resolve();

            const publishedNotification = publishSpy.mock.calls
                .map(call => call[0])
                .find(evt =>
                    evt instanceof PubkeySourceNotificationEvent &&
                    evt.notification.includes(
                        `Connecting to ${RELAY_URLS[0]}`,
                    ),
                );

            expect(publishedNotification).toBeDefined();

            source.stop();
        });

        it('publishes a notification when connected to a relay', async () => {
            const RELAY_URLS = ['wss://relay1.com'];
            const mockSubscription = { close: vi.fn() };

            const mockRelay = {
                url: RELAY_URLS[0],
                subscribe: vi.fn(() => mockSubscription),
                close: vi.fn(),
            } as unknown as Relay;

            const eventBus = mock<IEventBusPort>();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            const publishSpy = eventBus.publish;

            vi.spyOn(Relay, 'connect').mockImplementation(() => Promise.resolve(mockRelay));

            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: RELAY_URLS });
            subscription = source.start({ filters: [] }).subscribe();

            await Promise.resolve();

            const publishedNotification = publishSpy.mock.calls
                .map(call => call[0])
                .find(evt =>
                    evt instanceof PubkeySourceNotificationEvent &&
                    evt.notification.includes(
                        `Connected to ${RELAY_URLS[0]}`,
                    ),
                );

            expect(publishedNotification).toBeDefined();

            source.stop();
        });

        it('publishes a notification when subscribing to a relay', async () => {
            const RELAY_URLS = ['wss://relay1.com'];
            const mockSubscription = { close: vi.fn() };

            const mockRelay = {
                url: RELAY_URLS[0],
                subscribe: vi.fn(() => mockSubscription),
                close: vi.fn(),
            } as unknown as Relay;

            const eventBus = mock<IEventBusPort>();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            const publishSpy = eventBus.publish;

            vi.spyOn(Relay, 'connect').mockImplementation(() => Promise.resolve(mockRelay));

            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: RELAY_URLS });
            subscription = source.start({ filters: [] }).subscribe();

            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            const publishedNotification = publishSpy.mock.calls
                .map(call => call[0])
                .find(evt =>
                    evt instanceof PubkeySourceNotificationEvent &&
                    evt.notification.includes(
                        `Subscribing to ${RELAY_URLS[0]}`,
                    ),
                );

            expect(publishedNotification).toBeDefined();

            source.stop();
        });

        it('publishes an error when failing to connect to a relay', async () => {
            const RELAY_URL = 'wss://relay-error.com';
            const ERROR_MESSAGE = 'Connection failed';

            vi.spyOn(Relay, 'connect').mockImplementation(() => Promise.reject(new Error(ERROR_MESSAGE)));

            const eventBus = mock<IEventBusPort>();
            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 0 });

            subscription = source.start({ filters: [] }).subscribe({
                error: () => { /* ignore */ },
            });

            await new Promise(res => setTimeout(res, 0));

            const publishedError = eventBus.publish.mock.calls
                .map(call => call[0])
                .find(evt =>
                    evt instanceof PubkeySourceErrorEvent &&
                    evt.error.includes(`Failed to connect to ${RELAY_URL}`)
                );

            expect(publishedError).toBeDefined();

            source.stop();
        });

        it('publishes an error when a relay disconnects', async () => {
            const RELAY_URL = 'wss://relay1.com';
            const mockSubscription = { close: vi.fn() };

            const mockRelay = {
                url: RELAY_URL,
                subscribe: vi.fn((_filters: Filter[], { onclose }: SubscriptionCallbacks) => {
                    onclose?.(); // immediately close connection
                    return mockSubscription;
                }),
                close: vi.fn(),
            } as unknown as Relay;

            const eventBus = mock<IEventBusPort>();
            // eslint-disable-next-line @typescript-eslint/unbound-method
            const publishSpy = eventBus.publish;

            vi.spyOn(Relay, 'connect').mockResolvedValue(mockRelay);

            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 0 });
            subscription = source.start({ filters: [] }).subscribe();

            await new Promise(res => setTimeout(res, 0));

            const publishedError = publishSpy.mock.calls
                .map(call => call[0])
                .find(
                    evt =>
                        evt instanceof PubkeySourceErrorEvent &&
                        evt.error.includes(`Disconnected from ${RELAY_URL}`),
                );

            expect(publishedError).toBeDefined();

            source.stop();
        });

        it('reconnects to a relay when it refuses the connection', async() => {
            const PORT = 8093;
            const RELAY_URL = `ws://localhost:${String(PORT)}`;
            const connectSpy = vi.spyOn(Relay, 'connect');
            const eventBus = mock<IEventBusPort>();
            let connectionAttempts = 0;

            const server = new WebSocketServer({
                port: PORT,
                verifyClient: (_info, done) => {
                    connectionAttempts++;

                    connectionAttempts === 1 ? done(false) : done(true);
                }
            });

            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 0 });
            subscription = source.start({ filters: [] }).subscribe();

            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(connectSpy).toHaveBeenCalledTimes(2);
            expect(connectionAttempts).toEqual(2);

            source.stop();
            server.close();
        });

        it('reconnects to a relay when it disconnects', async () => {
            const PORT1 = 8091;
            const PORT2 = 8092;
            const RELAY_URL1 = `ws://localhost:${String(PORT1)}`;
            const RELAY_URL2 = `ws://localhost:${String(PORT2)}`;
            const RELAY_URLS = [RELAY_URL1, RELAY_URL2];
            const server1 = new WebSocketServer({ port: PORT1 });
            const server2 = new WebSocketServer({ port: PORT2 });
            const connectSpy = vi.spyOn(Relay, 'connect');
            const eventBus = mock<IEventBusPort>();
            let totalConnections1 = 0;
            let totalConnections2 = 0;

            server1.on('connection', function connection(ws) {
                if (totalConnections1 === 0) {
                    ws.close();
                }

                totalConnections1++;
            });

            server2.on('connection', function connection() {
                totalConnections2++;
            });

            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: RELAY_URLS, retryDelay: 0 });
            subscription = source.start({ filters: [] }).subscribe();

            await new Promise((resolve) => setTimeout(resolve, 100));

            const connectSpyCalls1 = connectSpy.mock.calls.filter(args=> args[0] === RELAY_URL1).length;
            const connectSpyCalls2 = connectSpy.mock.calls.filter(args=> args[0] === RELAY_URL2).length;

            expect(connectSpy).toHaveBeenCalledTimes(3);
            expect(connectSpyCalls1).toEqual(2);
            expect(connectSpyCalls2).toEqual(1);
            expect(totalConnections1).toEqual(2);
            expect(totalConnections2).toEqual(1);

            source.stop();
            server1.close();
            server2.close();
        });
    });

    describe('stop()', () => {
        it('stops the event stream', async () => {
            const PORT = 8094;
            const RELAY_URL = `ws://localhost:${String(PORT)}`;
            const server = new WebSocketServer({ port: PORT });
            const eventBus = mock<IEventBusPort>();
            let completed = false;

            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL] });

            subscription = source.start({ filters: [] }).subscribe({
                complete: () => { completed = true; },
            });

            await new Promise(res => setTimeout(res, 100));

            source.stop();

            await Promise.resolve();

            expect(subscription.closed).toBe(true);
            expect(completed).toBe(true);

            source.stop();
            server.close();
        });

        it('disconnects from all relays', async () => {
            const PORT1 = 8095;
            const PORT2 = 8096;
            const RELAY_URL1 = `ws://localhost:${String(PORT1)}`;
            const RELAY_URL2 = `ws://localhost:${String(PORT2)}`;
            const server1 = new WebSocketServer({ port: PORT1 });
            const server2 = new WebSocketServer({ port: PORT2 });
            const eventBus = mock<IEventBusPort>();
            let closedTimes = 0;

            server1.on('connection', function connection(ws) {
                ws.on('close', function close() {
                    closedTimes++;
                });
            });

            server2.on('connection', function connection(ws) {
                ws.on('close', function close() {
                    closedTimes++;
                });
            });
            
            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL1, RELAY_URL2] });

            subscription = source.start({ filters: [] }).subscribe();

            await new Promise(res => setTimeout(res, 100));

            source.stop();

            await new Promise(res => setTimeout(res, 100));

            expect(closedTimes).toEqual(2);

            source.stop();
            server1.close();
            server2.close();
        });

        it('publishes a notification when disconnecting from a relay', async () => {
            const RELAY_URL = 'wss://relay1.com';
            const mockSubscription = { close: vi.fn() };

            const mockRelay = {
                url: RELAY_URL,
                subscribe: vi.fn(() => mockSubscription),
                close: vi.fn(),
            } as unknown as Relay;

            const eventBus = mock<IEventBusPort>();
            // eslint-disable-next-line @typescript-eslint/unbound-method
            const publishSpy = eventBus.publish;

            vi.spyOn(Relay, 'connect').mockResolvedValue(mockRelay);

            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL] });
            subscription = source.start({ filters: [] }).subscribe();

            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            source.stop();

            await new Promise(res => setTimeout(res, 0)); // wait for finalize

            const publishedNotification = publishSpy.mock.calls
                .map(call => call[0])
                .find(
                    evt =>
                        evt instanceof PubkeySourceNotificationEvent &&
                        evt.notification.includes(`Closing connection to ${RELAY_URL}`),
                );

            expect(publishedNotification).toBeDefined();
        });
    });
});
