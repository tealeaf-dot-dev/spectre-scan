import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Relay, Filter } from "nostr-tools";
import { SubscriptionParams } from "nostr-tools/lib/types/abstract-relay.js";
import { WebSocketServer } from "ws";
import { firstValueFrom, take, toArray, Subscription } from "rxjs";
import { NostrToolsRelayScanner } from "../../../src/nostr/nostr-tools/NostrToolsRelayScanner.js";
import { IEvent } from "../../../src/shared/interfaces/IEvent.js";

let scanner: NostrToolsRelayScanner;
let subscription: Subscription;

beforeEach(() => {
    scanner = new NostrToolsRelayScanner();
});

afterEach(async () => {
    scanner.stop();
    subscription.unsubscribe();
    await Promise.resolve();
    vi.clearAllMocks();
    vi.restoreAllMocks();
});

describe('NostrToolsRelayScanner', () => {
    describe('scan(relayURLs, filters, retryDelay)', () => {
        it('connects to the relays in relayURLs', async () => {
            const RELAY_URLS = ['wss://relay1.com', 'wss://relay2.com'];
            const mockSubscription = { close: vi.fn() };
            const mockRelay = { subscribe: vi.fn(() => mockSubscription) } as unknown as Relay;
            const connectSpy = vi.spyOn(Relay, 'connect')
                .mockImplementation(() => Promise.resolve(mockRelay));
            subscription = scanner.scan(RELAY_URLS, []).subscribe();

            await Promise.resolve();

            expect(connectSpy).toHaveBeenCalledTimes(RELAY_URLS.length);

            RELAY_URLS.forEach(url => {
                expect(connectSpy).toHaveBeenCalledWith(url);
            });
        });

        it('receives events from relays and returns their pubkeys', async () => {
            const RELAY_URLS = ['wss://relay1.com', 'wss://relay2.com'];
            const PUBKEYS_FROM_RELAY1 = ['pubkey1', 'pubkey2'];
            const PUBKEYS_FROM_RELAY2 = ['pubkey3'];

            const eventsRelay1 = PUBKEYS_FROM_RELAY1.map(
                pk => ({ pubkey: pk } as unknown as IEvent),
            );

            const eventsRelay2 = PUBKEYS_FROM_RELAY2.map(
                pk => ({ pubkey: pk } as unknown as IEvent),
            );

            const mockRelay1 = {
                url: RELAY_URLS[0],
                subscribe: vi.fn((_filters: Filter[], { onevent, onclose }: Partial<SubscriptionParams>) => {
                    eventsRelay1.forEach(evt => onevent(evt));
                    onclose?.();

                    return { close: vi.fn() };
                }),
            } as unknown as Relay;

            const mockRelay2 = {
                url: RELAY_URLS[1],
                subscribe: vi.fn((_filters: Filter[], { onevent, onclose }: Partial<SubscriptionParams>) => {
                    eventsRelay2.forEach(evt => onevent(evt));
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

            const receivedPubkeys = await firstValueFrom(
                scanner.scan(RELAY_URLS, []).pipe(take(totalEvents), toArray()),
            );

            expect(receivedPubkeys).toHaveLength(totalEvents);
            expect(receivedPubkeys).toEqual(
                expect.arrayContaining([...PUBKEYS_FROM_RELAY1, ...PUBKEYS_FROM_RELAY2]),
            );
        });

        it('reconnects to a relay when it refuses the connection', async() => {
            const PORT = 8093;
            const RELAY_URL = `ws://localhost:${String(PORT)}`;
            const connectSpy = vi.spyOn(Relay, 'connect');
            let connectionAttempts = 0;

            const server = new WebSocketServer({
                port: PORT,
                verifyClient: (_info, done) => {
                    console.log('verifyClient');
                    connectionAttempts++;

                    connectionAttempts === 1 ? done(false) : done(true);
                }
            });

            subscription = scanner.scan([RELAY_URL], [], 0).subscribe();

            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(connectSpy).toHaveBeenCalledTimes(2);
            expect(connectionAttempts).toEqual(2);

            server.close();
        });

        it('reconnects to a relay when it closes the connection', async () => {
            const PORT1 = 8091;
            const PORT2 = 8092;
            const RELAY_URL1 = `ws://localhost:${String(PORT1)}`;
            const RELAY_URL2 = `ws://localhost:${String(PORT2)}`;
            const RELAY_URLS = [RELAY_URL1, RELAY_URL2];
            const server1 = new WebSocketServer({ port: PORT1 });
            const server2 = new WebSocketServer({ port: PORT2 });
            const connectSpy = vi.spyOn(Relay, 'connect');
            let totalConnections1 = 0;
            let totalConnections2 = 0;

            server1.on('connection', function connection(ws) {
                if (totalConnections1 === 0) {
                    ws.close();
                }

                totalConnections1++;
            });

            server2.on('connection', function connection(_ws) {
                totalConnections2++;
            });

            subscription = scanner.scan(RELAY_URLS, [], 0).subscribe();

            await new Promise((resolve) => setTimeout(resolve, 100));

            const connectSpyCalls1 = connectSpy.mock.calls.filter(args=> args[0] === RELAY_URL1).length;
            const connectSpyCalls2 = connectSpy.mock.calls.filter(args=> args[0] === RELAY_URL2).length;

            expect(connectSpy).toHaveBeenCalledTimes(3);
            expect(connectSpyCalls1).toEqual(2);
            expect(connectSpyCalls2).toEqual(1);
            expect(totalConnections1).toEqual(2);
            expect(totalConnections2).toEqual(1);

            server1.close();
            server2.close();
        });
    });

    describe('stop()', () => {
        it('stops scanning', async () => {
            const PORT = 8094;
            const RELAY_URL = `ws://localhost:${String(PORT)}`;
            const server = new WebSocketServer({ port: PORT });
            let completed = false;

            subscription = scanner.scan([RELAY_URL], []).subscribe({
                complete: () => { completed = true; },
            });

            await new Promise(res => setTimeout(res, 100));

            scanner.stop();

            await Promise.resolve();

            expect(subscription.closed).toBe(true);
            expect(completed).toBe(true);

            server.close();
        });

        it('disconnects from all relays', async () => {
            const PORT1 = 8095;
            const PORT2 = 8096;
            const RELAY_URL1 = `ws://localhost:${String(PORT1)}`;
            const RELAY_URL2 = `ws://localhost:${String(PORT2)}`;
            const server1 = new WebSocketServer({ port: PORT1 });
            const server2 = new WebSocketServer({ port: PORT2 });
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

            subscription = scanner.scan([RELAY_URL1, RELAY_URL2], []).subscribe();

            await new Promise(res => setTimeout(res, 100));

            scanner.stop();

            await new Promise(res => setTimeout(res, 100));

            expect(closedTimes).toEqual(2);

            server1.close();
            server2.close();
        });
    });
});
