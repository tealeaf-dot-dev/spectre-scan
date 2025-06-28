import { describe, it, expect, vi, afterEach } from "vitest";
import { mock } from 'vitest-mock-extended';
import { Relay, Filter } from "nostr-tools";
import { WebSocketServer } from "ws";
import { firstValueFrom, take, toArray, Subscription as RxjsSubscription, Observable } from "rxjs";
import { NostrToolsPubkeySource } from "../../../../../src/infra/sources/nostr-tools/adapters/NostrToolsPubkeySource.js";
import { IEvent } from "../../../../../src/core/data/IEvent.js";
import { IEventBusPort } from "../../../../../src/core/eventing/ports/event-bus/IEventBusPort.js";
import { PubkeySourceErrorEvent } from "../../../../../src/core/scanners/pubkey/eventing/events/PubkeySourceErrorEvent.js";
import { PubkeyFoundEvent } from "../../../../../src/core/recorders/pubkey/eventing/events/PubkeyFoundEvent.js";
import { isPubkeySourceErrorEvent } from "../../../../../src/core/scanners/pubkey/eventing/type-guards/isPubkeySourceErrorEvent.js";
import { bimap, Either, isRight, map, right, sequenceArray } from "fp-ts/lib/Either.js";
import { Subscription } from "nostr-tools/lib/types/abstract-relay";

type SubscriptionCallbacks = {
    onevent?: (event: IEvent) => void;
    onclose?: (_: string) => void;
};

let subscription: RxjsSubscription;
let subscription2: RxjsSubscription;

afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
});

interface SubscriptionInstance {
    url: string;
}

describe('NostrToolsPubkeySource', () => {
    describe('constructor()', () => {
        it('initializes properties', () => {
            const RELAY_URLS = ['ws://localhost:12345', 'ws://localhost:23456'];
            const eventBus = mock<IEventBusPort>();
            const retryDelay = 1234;

            const source = new NostrToolsPubkeySource({ eventBus, retryDelay, relayURLs: RELAY_URLS });

            expect(source.eventBus).toStrictEqual(eventBus);
            expect(source.relayURLs).toStrictEqual(RELAY_URLS);
            expect(source.retryDelay).toStrictEqual(retryDelay);
        });
    });
    
    describe('start()', () => {
        it('creates an RxJS Observable', () => {
            const eventBus = mock<IEventBusPort>();
            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: ['wss://relay1.com'] });
            const obs = source.start({ filters: [] });

            expect(obs).toBeInstanceOf(Observable);
        });

        describe('when the Observable is subscribed to', () => {
            afterEach(async () => {
                subscription?.unsubscribe(); // eslint-disable-line
                subscription2?.unsubscribe(); // eslint-disable-line
                await Promise.resolve();
            });

            it('it connects to multiple relays', async () => {
                const PORT1 = 8095;
                const PORT2 = 8096;
                const RELAY_URL1 = `ws://localhost:${String(PORT1)}`;
                const RELAY_URL2 = `ws://localhost:${String(PORT2)}`;
                const server1 = new WebSocketServer({ port: PORT1 });
                const server2 = new WebSocketServer({ port: PORT2 });
                const eventBus = mock<IEventBusPort>();
                let server1Connections = 0;
                let server2Connections = 0;

                server1.on('connection', function connection(_ws) {
                    server1Connections++;
                });

                server2.on('connection', function connection(_ws) {
                    server2Connections++;
                });

                const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL1, RELAY_URL2] });

                subscription = source.start({ filters: [] }).subscribe();

                await new Promise(res => setTimeout(res, 100));

                source.stop();

                await new Promise(res => setTimeout(res, 100));

                expect(server1Connections).toEqual(1);
                expect(server2Connections).toEqual(1);

                source.stop();
                server1.close();
                server2.close();
            });

            it('it creates a Nostr subscription to each connection', async () => {
                const PORT1 = 8295;
                const PORT2 = 8296;
                const RELAY_URL1 = `ws://localhost:${String(PORT1)}`;
                const RELAY_URL2 = `ws://localhost:${String(PORT2)}`;
                const eventBus = mock<IEventBusPort>();
                const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL1, RELAY_URL2], retryDelay: 0 });
                const subscriptions: Array<unknown[]> = [];
                const expectedSubscriptions = [
                    [ 'REQ', 'sub:1', { kinds: [1] }, 8295 ],
                    [ 'REQ', 'sub:1', { kinds: [1] }, 8296 ]
                ];
                const server1 = new WebSocketServer({ port: PORT1 });
                const server2 = new WebSocketServer({ port: PORT2 });

                server1.on('connection', function connection(ws) {
                    ws.on('error', console.error);

                    ws.on('message', (data, isBinary) => {
                        const text = isBinary ? Buffer.from(data as ArrayBuffer).toString() : (data as Buffer).toString();
                        const message = JSON.parse(text) as Array<unknown>;

                        message.push(this.options.port);
                        subscriptions.push(message);
                    });
                });

                server2.on('connection', function connection(ws) {
                    ws.on('error', console.error);

                    ws.on('message', (data, isBinary) => {
                        const text = isBinary ? Buffer.from(data as ArrayBuffer).toString() : (data as Buffer).toString();
                        const message = JSON.parse(text) as Array<unknown>;

                        message.push(this.options.port);
                        subscriptions.push(message);
                    });
                });

                const obs = source.start({ filters: [ { kinds: [1] } ] });

                obs.subscribe();

                await new Promise((res) => setTimeout(res, 100));

                expect(subscriptions).toStrictEqual(expectedSubscriptions);

                source.stop();
                server1.close();
                server2.close();
            });

            describe('and a Nostr subscription is active', () => {
                it('it receives Nostr events and returns their pubkeys', async () => {
                    const RELAY_URLS = ['wss://relay1.com', 'wss://relay2.com'];
                    const PUBKEYS_FROM_RELAY1 = ['pubkey1', 'pubkey2'];
                    const PUBKEYS_FROM_RELAY2 = ['pubkey3'];
                    const eventBus = mock<IEventBusPort>();

                    const eventsFromRelay1 = PUBKEYS_FROM_RELAY1.map(
                        pk => ({ pubkey: pk } as unknown as IEvent),
                    );

                    const eventsFromRelay2 = PUBKEYS_FROM_RELAY2.map(
                        pk => ({ pubkey: pk } as unknown as IEvent),
                    );

                    vi.spyOn(Relay.prototype, 'subscribe').mockImplementation(function (
                        _filters: Filter[],
                        callbacks: SubscriptionCallbacks,
                    ): Subscription {
                        const url: string = (this as SubscriptionInstance).url;
                        const events = url.includes('relay1.com') ? eventsFromRelay1 : url.includes('relay2.com') ? eventsFromRelay2 : [];

                        // emit events asynchronously
                        setTimeout(() => {
                            events.forEach(evt => callbacks.onevent?.(evt));
                            callbacks.onclose?.('');
                        }, 0);

                        // return a minimal subscription object
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                        return { close: vi.fn() } as unknown as Subscription;
                    });

                    vi.spyOn(Relay.prototype, 'connect').mockImplementation(() => {
                        return Promise.resolve();
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

                describe('and the relay connection unexpectedly closes', () => {
                    it('it attempts to reconnect after a configurable delay', async() => {
                        const RELAY_URL = 'wss://relay-error.com';
                        const eventBus = mock<IEventBusPort>();
                        let connectionAttempts = 0;

                        const connectSpy = vi.spyOn(Relay.prototype, 'connect').mockImplementation(function (): Promise<void> {
                            connectionAttempts++;

                            if (connectionAttempts === 1) {
                                setTimeout(() => {
                                    this.onclose?.(); // eslint-disable-line
                                }, 100);
                            }

                            // create the promise so relay.send() considers the connection open
                            this.connectionPromise = Promise.resolve(); // eslint-disable-line
                            this._connected = true; // eslint-disable-line

                            return this.connectionPromise as Promise<void>; // eslint-disable-line
                        });

                        const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 20 });

                        subscription = source.start({ filters: [] }).subscribe();

                        await new Promise((res) => setTimeout(res, 50));

                        expect(connectionAttempts).toEqual(1);

                        await new Promise((res) => setTimeout(res, 100));

                        expect(connectionAttempts).toEqual(2);
                        expect(connectSpy).toHaveBeenCalledTimes(2);

                        source.stop();
                    });

                    it('it publishes an error event', async() => {
                        const RELAY_URL = 'wss://relay-error.com';
                        const eventBus = mock<IEventBusPort>();
                        const publishSpy = eventBus.publish; // eslint-disable-line

                        let connectionAttempts = 0;

                        const connectSpy = vi.spyOn(Relay.prototype, 'connect').mockImplementation(function (): Promise<void> {
                            connectionAttempts++;

                            if (connectionAttempts === 1) {
                                setTimeout(() => {
                                    this.onclose?.(); // eslint-disable-line
                                }, 100);
                            }

                            // create the promise so relay.send() considers the connection open
                            this.connectionPromise = Promise.resolve(); // eslint-disable-line
                            this._connected = true; // eslint-disable-line

                            return this.connectionPromise as Promise<void>; // eslint-disable-line
                        });

                        const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 20 });

                        subscription = source.start({ filters: [] }).subscribe();

                        await new Promise((res) => setTimeout(res, 150));

                        const errorEvents = publishSpy.mock.calls.filter(arr => isPubkeySourceErrorEvent(arr[0]));

                        expect(connectionAttempts).toEqual(2);
                        expect(connectSpy).toHaveBeenCalledTimes(2);
                        expect(errorEvents.length).toEqual(1);

                        source.stop();
                    });
                });

                describe('and the relay closes the Nostr subscription', () => {
                    it('it attempts to resubscribe after a configurable delay', async() => {
                        const PORT = 8093;
                        const RELAY_URL = `ws://localhost:${String(PORT)}`;
                        const eventBus = mock<IEventBusPort>();
                        const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 50 });
                        const subscriptions: Array<unknown[]> = [];
                        const expectedSubscriptions = [
                            [ 'REQ', 'sub:1', { kinds: [ 1 ] } ],
                            [ 'REQ', 'sub:2', { kinds: [ 1 ] } ],
                            [ 'REQ', 'sub:3', { kinds: [ 1 ] } ],
                        ];

                        const server = new WebSocketServer({ port: PORT });

                        server.on('connection', function connection(ws) {
                            ws.on('error', console.error);

                            ws.on('message', function message(data, isBinary) {
                                const text = isBinary ? Buffer.from(data as ArrayBuffer).toString() : (data as Buffer).toString();
                                const message = JSON.parse(text) as Array<unknown>;

                                subscriptions.push(message);

                                ws.send(JSON.stringify(["CLOSED", message[1], 'closed by meeeee!']));
                            });
                        });

                        subscription = source.start({ filters: [ { kinds: [1] } ] }).subscribe();

                        await new Promise((res) => setTimeout(res, 120));

                        expect(subscriptions).toStrictEqual(expectedSubscriptions);

                        source.stop();
                        server.close();
                    });

                    it('it publishes an error event', async() => {
                        const PORT = 8099;
                        const RELAY_URL = `ws://localhost:${String(PORT)}`;
                        const eventBus = mock<IEventBusPort>();
                        const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 50 });
                        const publishSpy = eventBus.publish; // eslint-disable-line

                        const server = new WebSocketServer({ port: PORT });

                        server.on('connection', function connection(ws) {
                            ws.on('error', console.error);

                            ws.on('message', function message(data, isBinary) {
                                const text = isBinary ? Buffer.from(data as ArrayBuffer).toString() : (data as Buffer).toString();
                                const message = JSON.parse(text) as Array<string>;

                                ws.send(JSON.stringify(["CLOSED", message[1], 'closed by meeeee!']));
                            });
                        });

                        subscription = source.start({ filters: [ { kinds: [1] } ] }).subscribe();

                        await new Promise((res) => setTimeout(res, 120));

                        const errorEvents = publishSpy.mock.calls.filter(arr => isPubkeySourceErrorEvent(arr[0]));

                        expect(errorEvents.length).toEqual(3);

                        source.stop();
                        server.close();
                    });
                });

                describe("and some subscribers unsubscribe", () => {
                    it('it keeps the Nostr subscription open', async() => {
                        const PORT = 8293;
                        const RELAY_URL = `ws://localhost:${String(PORT)}`;
                        const eventBus = mock<IEventBusPort>();
                        const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 0 });
                        const subscriptions: Array<unknown[]> = [];
                        const expectedSubscriptions = [
                            [ 'REQ', 'sub:1', { kinds: [1] } ]
                        ];

                        const server = new WebSocketServer({ port: PORT });

                        server.on('connection', function connection(ws) {
                            ws.on('error', console.error);

                            ws.on('message', function message(data, isBinary) {
                                const text = isBinary ? Buffer.from(data as ArrayBuffer).toString() : (data as Buffer).toString();
                                const message = JSON.parse(text) as Array<unknown>;

                                subscriptions.push(message);
                            });
                        });

                        const obs = source.start({ filters: [ { kinds: [1] } ] });
                        //const obs2 = source.start({ filters: [ { kinds: [1] } ] });
                        //
                        //obs2.subscribe();

                        const subscription3 = obs.subscribe();
                        obs.subscribe();

                        await new Promise((res) => setTimeout(res, 100));

                        subscription3.unsubscribe();

                        await new Promise((res) => setTimeout(res, 100));

                        expect(subscriptions).toStrictEqual(expectedSubscriptions);

                        source.stop();
                        server.close();
                    });
                });

                describe("and all subscribers unsubscribe", () => {
                    it('closes the Nostr subscription', async() => {
                        const PORT = 8293;
                        const RELAY_URL = `ws://localhost:${String(PORT)}`;
                        const eventBus = mock<IEventBusPort>();
                        const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 0 });
                        const subscriptions: Array<unknown[]> = [];

                        const expectedSubscriptions = [
                            [ 'REQ', 'sub:1', { kinds: [1] } ],
                            [ 'CLOSE', 'sub:1' ]
                        ];

                        const server = new WebSocketServer({ port: PORT });

                        server.on('connection', function connection(ws) {
                            ws.on('error', console.error);

                            ws.on('message', function message(data, isBinary) {
                                const text = isBinary ? Buffer.from(data as ArrayBuffer).toString() : (data as Buffer).toString();
                                const message = JSON.parse(text) as Array<unknown>;

                                subscriptions.push(message);
                            });
                        });

                        const obs = source.start({ filters: [ { kinds: [1] } ] });
                        const subscription3 = obs.subscribe();
                        const subscription4 = obs.subscribe();

                        await new Promise((res) => setTimeout(res, 100));

                        subscription3.unsubscribe();
                        subscription4.unsubscribe();

                        await new Promise((res) => setTimeout(res, 100));

                        expect(subscriptions).toStrictEqual(expectedSubscriptions);

                        source.stop();
                        server.close();
                    });

                    it('closes the relay connection', async() => {
                        const PORT = 8293;
                        const RELAY_URL = `ws://localhost:${String(PORT)}`;
                        const eventBus = mock<IEventBusPort>();
                        const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 0 });
                        const closedConnectionPorts: Array<number> = [];
                        const server = new WebSocketServer({ port: PORT });

                        server.on('connection', function connection(ws) {
                            ws.on('error', console.error);

                            ws.on('close', () => {
                                if (this.options.port !== undefined) {
                                    closedConnectionPorts.push(this.options.port);
                                }
                            });
                        });

                        const obs = source.start({ filters: [ { kinds: [1] } ] });
                        const subscription3 = obs.subscribe();
                        const subscription4 = obs.subscribe();

                        await new Promise((res) => setTimeout(res, 100));

                        subscription3.unsubscribe();
                        subscription4.unsubscribe();

                        await new Promise((res) => setTimeout(res, 100));

                        expect(closedConnectionPorts).toStrictEqual([PORT]);

                        source.stop();
                        server.close();
                    });
                });
            });

            describe('and it fails to connect to a relay', () => {
                describe('because the relay rejects the connection', () => {
                    it('it attempts to reconnect', async() => {
                        const PORT = 8093;
                        const RELAY_URL = `ws://localhost:${String(PORT)}`;
                        const connectSpy = vi.spyOn(Relay.prototype, 'connect');
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

                        expect(connectionAttempts).toEqual(2);
                        expect(connectSpy).toHaveBeenCalledTimes(2);

                        source.stop();
                        server.close();
                    });
                });

                describe('because the relay times out', () => {
                    it('it attempts to reconnect', async() => {
                        const PORT = 8093;
                        const RELAY_URL = `ws://localhost:${String(PORT)}`;
                        const connectSpy = vi.spyOn(Relay.prototype, 'connect');
                        const eventBus = mock<IEventBusPort>();
                        let connectionAttempts = 0;

                        const server = new WebSocketServer({
                            port: PORT,
                            verifyClient: (_info, done) => {
                                connectionAttempts++;

                                setTimeout(() => {
                                    done(true);
                                }, 6000);
                            }
                        });

                        const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 0, connectionTimeoutDelay: 100 });
                        subscription = source.start({ filters: [] }).subscribe();

                        await new Promise((resolve) => setTimeout(resolve, 150));

                        expect(connectionAttempts).toEqual(2);
                        expect(connectSpy).toHaveBeenCalledTimes(2);

                        source.stop();
                        server.close();
                    });
                });

                describe('it always', () => {
                    it('publishes an error event', async () => {
                        const RELAY_URLS = ['wss://localhost:12345'];
                        const eventBus = mock<IEventBusPort>();
                        // eslint-disable-next-line @typescript-eslint/unbound-method
                        const publishSpy = eventBus.publish;

                        vi.spyOn(Relay.prototype, 'connect').mockImplementation(() => Promise.reject(new Error('connection rejected')));

                        const source = new NostrToolsPubkeySource({ eventBus, relayURLs: RELAY_URLS, retryDelay: 10000 });

                        subscription = source.start({ filters: [] }).subscribe({
                            error: () => {},
                        });

                        await new Promise(res => setTimeout(res, 0));

                        expect(publishSpy).toHaveBeenCalledTimes(2);
                        expect(publishSpy.mock.calls[1][0]).toBeInstanceOf(PubkeySourceErrorEvent);

                        source.stop();
                    });

                    it('waits for a configurable delay before attempting to reconnect', async() => {
                        const RELAY_URLS = ['wss://localhost:12345'];
                        const eventBus = mock<IEventBusPort>();
                        const connectionSpy = vi.spyOn(Relay.prototype, 'connect').mockImplementation(() => Promise.reject(new Error('connection rejected')));
                        const source1 = new NostrToolsPubkeySource({ eventBus, relayURLs: RELAY_URLS, retryDelay: 80 });
                        const source2 = new NostrToolsPubkeySource({ eventBus, relayURLs: RELAY_URLS, retryDelay: 110 });

                        subscription = source1.start({ filters: [] }).subscribe({
                            error: () => {},
                        });

                        subscription2 = source2.start({ filters: [] }).subscribe({
                            error: () => {},
                        });

                        await new Promise(res => setTimeout(res, 100));

                        expect(connectionSpy).toHaveBeenCalledTimes(3);

                        await new Promise(res => setTimeout(res, 20));

                        expect(connectionSpy).toHaveBeenCalledTimes(4);

                        source1.stop();
                        source2.stop();
                    });
                });
            });

            describe('multiple times concurrently', () => {
                it('it maintains a single connection per relay', async() => {
                    const PORT = 8293;
                    const RELAY_URL = `ws://localhost:${String(PORT)}`;
                    const eventBus = mock<IEventBusPort>();
                    const server = new WebSocketServer({ port: PORT });
                    const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 0 });
                    const obs = source.start({ filters: [ { kinds: [1] } ] });

                    obs.subscribe();
                    obs.subscribe();

                    await new Promise((res) => setTimeout(res, 100));

                    expect(server.clients.size).toEqual(1);

                    source.stop();
                    server.close();
                });

                it('it maintains a single Nostr subscription to each connected relay', async() => {
                    const PORT = 8293;
                    const RELAY_URL = `ws://localhost:${String(PORT)}`;
                    const eventBus = mock<IEventBusPort>();
                    const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 0 });
                    const subscriptions: Array<unknown[]> = [];
                    const expectedSubscriptions = [
                        [ 'REQ', 'sub:1', { kinds: [1] } ]
                    ];

                    const server = new WebSocketServer({ port: PORT });

                    server.on('connection', function connection(ws) {
                        ws.on('error', console.error);

                        ws.on('message', function message(data, isBinary) {
                            const text = isBinary ? Buffer.from(data as ArrayBuffer).toString() : (data as Buffer).toString();
                            const message = JSON.parse(text) as Array<unknown>;

                            subscriptions.push(message);
                        });
                    });

                    const obs = source.start({ filters: [ { kinds: [1] } ] });

                    obs.subscribe();
                    obs.subscribe();

                    await new Promise((res) => setTimeout(res, 100));

                    expect(subscriptions).toStrictEqual(expectedSubscriptions);

                    source.stop();
                    server.close();
                });

                it('it shares Nostr events among all subscriptions', async () => {
                    const RELAY_URLS = ['wss://relay1.com', 'wss://relay2.com'];
                    const PUBKEYS_FROM_RELAY1 = ['pubkey1', 'pubkey2'];
                    const PUBKEYS_FROM_RELAY2 = ['pubkey3'];
                    const eventBus = mock<IEventBusPort>();
                    const results1: Array<Either<PubkeySourceErrorEvent, PubkeyFoundEvent>> = [];
                    const results2: Array<Either<PubkeySourceErrorEvent, PubkeyFoundEvent>> = [];

                    const eventsFromRelay1 = PUBKEYS_FROM_RELAY1.map(
                        pk => ({ pubkey: pk } as unknown as IEvent),
                    );

                    const eventsFromRelay2 = PUBKEYS_FROM_RELAY2.map(
                        pk => ({ pubkey: pk } as unknown as IEvent),
                    );

                    vi.spyOn(Relay.prototype, 'subscribe').mockImplementation(function (
                        _filters: Filter[],
                        callbacks: SubscriptionCallbacks,
                    ): Subscription {
                        const url: string = (this as SubscriptionInstance).url;
                        const events = url.includes('relay1.com') ? eventsFromRelay1 : url.includes('relay2.com') ? eventsFromRelay2 : [];

                        // emit events asynchronously
                        setTimeout(() => {
                            events.forEach(evt => callbacks.onevent?.(evt));
                            callbacks.onclose?.('');
                        }, 50);

                        // return a minimal subscription object
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                        return { close: vi.fn() } as unknown as Subscription;
                    });

                    vi.spyOn(Relay.prototype, 'connect').mockImplementation(() => {
                        return Promise.resolve();
                    });

                    const totalEvents = PUBKEYS_FROM_RELAY1.length + PUBKEYS_FROM_RELAY2.length;
                    const source = new NostrToolsPubkeySource({ eventBus, relayURLs: RELAY_URLS });
                    const obs = source.start({ filters: [] });

                    obs.subscribe(res => results1.push(res));
                    obs.subscribe(res => results2.push(res));

                    await new Promise(res => setTimeout(res, 100));

                    expect(results1).toHaveLength(totalEvents);

                    results1.forEach(evt => {
                        expect(isRight(evt)).toEqual(true);
                        bimap(
                            (evt: PubkeySourceErrorEvent) => { expect(evt).toBeInstanceOf(PubkeyFoundEvent); },
                            (evt: PubkeyFoundEvent) => { expect(evt).toBeInstanceOf(PubkeyFoundEvent); },
                        )(evt);
                    });

                    const foundPubkeys1 = sequenceArray(
                        results1.map(
                            result => map((evt: PubkeyFoundEvent) => evt.data.pubkey)(result)
                        ).sort()
                    );

                    expect(foundPubkeys1).toStrictEqual(right(
                        [...PUBKEYS_FROM_RELAY1, ...PUBKEYS_FROM_RELAY2].sort()
                    ));

                    expect(results2).toHaveLength(totalEvents);

                    results2.forEach(evt => {
                        expect(isRight(evt)).toEqual(true);
                        bimap(
                            (evt: PubkeySourceErrorEvent) => { expect(evt).toBeInstanceOf(PubkeyFoundEvent); },
                            (evt: PubkeyFoundEvent) => { expect(evt).toBeInstanceOf(PubkeyFoundEvent); },
                        )(evt);
                    });

                    const foundPubkeys2 = sequenceArray(
                        results1.map(
                            result => map((evt: PubkeyFoundEvent) => evt.data.pubkey)(result)
                        ).sort()
                    );

                    expect(foundPubkeys2).toStrictEqual(right(
                        [...PUBKEYS_FROM_RELAY1, ...PUBKEYS_FROM_RELAY2].sort()
                    ));

                    source.stop();
                });
            });
        });
    });
});
