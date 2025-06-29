import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { Relay, Filter } from "nostr-tools";
import { WebSocketServer } from "ws";
import { firstValueFrom, take, toArray, Subscription as RxjsSubscription, Observable, Subject, shareReplay } from "rxjs";
import { NostrToolsPubkeySource } from "../../../../../src/infra/sources/nostr-tools/adapters/NostrToolsPubkeySource.js";
import { IEvent } from "../../../../../src/core/data/IEvent.js";
import { IEventBusPort } from "../../../../../src/core/eventing/ports/event-bus/IEventBusPort.js";
import { PubkeySourceErrorEvent } from "../../../../../src/core/scanners/pubkey/eventing/events/PubkeySourceErrorEvent.js";
import { PubkeyFoundEvent } from "../../../../../src/core/recorders/pubkey/eventing/events/PubkeyFoundEvent.js";
import { isPubkeySourceErrorEvent } from "../../../../../src/core/scanners/pubkey/eventing/type-guards/isPubkeySourceErrorEvent.js";
import { isPubkeySourceNotificationEvent } from "../../../../../src/core/scanners/pubkey/eventing/type-guards/isPubkeySourceNotificationEvent.js";
import { bimap, Either, isRight, map, right, sequenceArray } from "fp-ts/lib/Either.js";
import { Subscription } from "nostr-tools/lib/types/abstract-relay";
import { IDomainEvent } from "../../../../../src/core/eventing/events/IDomainEvent.js";
import { IDomainEventData } from "../../../../../src/core/eventing/data/IDomainEventData.js";

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

interface IExtendedEventBusPort extends IEventBusPort {
    events: Array<IDomainEvent<IDomainEventData>>;
}

function createEventBus(): IExtendedEventBusPort {
    const eventSubject = new Subject<IDomainEvent<IDomainEventData>>();
    const events: Array<IDomainEvent<IDomainEventData>> = [];

    const eventBus: IExtendedEventBusPort = {
        events: events,
        events$: eventSubject.asObservable().pipe(shareReplay()),
        publish: (e) => { eventSubject.next(e); events.push(e); },
    };

    return eventBus;
}

let eventBus: IExtendedEventBusPort;

beforeEach(() => {
    eventBus = createEventBus();
});

describe('NostrToolsPubkeySource', () => {
    describe('constructor()', () => {
        it('initializes properties', () => {
            const RELAY_URLS = ['ws://localhost:12345', 'ws://localhost:23456'];
            const retryDelay = 1234;

            const source = new NostrToolsPubkeySource({ eventBus, retryDelay, relayURLs: RELAY_URLS });

            expect(source.eventBus).toStrictEqual(eventBus);
            expect(source.relayURLs).toStrictEqual(RELAY_URLS);
            expect(source.retryDelay).toStrictEqual(retryDelay);
        });
    });
    
    describe('start()', () => {
        it('creates an RxJS Observable', () => {
            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: ['ws://localhost:12345'] });
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

                await new Promise(res => setTimeout(res, 200));

                expect(server1Connections).toEqual(1);
                expect(server2Connections).toEqual(1);

                server1.close();
                server2.close();
            });

            it('it publishes a notification of each connection attempt', async () => {
                const PORT1 = 8095;
                const PORT2 = 8096;
                const RELAY_URL1 = `ws://localhost:${String(PORT1)}`;
                const RELAY_URL2 = `ws://localhost:${String(PORT2)}`;
                const server1 = new WebSocketServer({ port: PORT1 });
                const server2 = new WebSocketServer({ port: PORT2 });
                const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL1, RELAY_URL2] });

                subscription = source.start({ filters: [] }).subscribe();

                await new Promise(res => setTimeout(res, 100));

                const notificationEvents = eventBus.events.filter(isPubkeySourceNotificationEvent);

                expect(notificationEvents.filter(e => e.message === `Connecting to ${RELAY_URL1}`)).toHaveLength(1);
                expect(notificationEvents.filter(e => e.message === `Connecting to ${RELAY_URL2}`)).toHaveLength(1);

                server1.close();
                server2.close();
            });

            it('it publishes a notification of each successful connection', async () => {
                const PORT1 = 8095;
                const PORT2 = 8096;
                const RELAY_URL1 = `ws://localhost:${String(PORT1)}`;
                const RELAY_URL2 = `ws://localhost:${String(PORT2)}`;
                const server1 = new WebSocketServer({ port: PORT1 });
                const server2 = new WebSocketServer({ port: PORT2 });
                const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL1, RELAY_URL2] });

                subscription = source.start({ filters: [] }).subscribe();

                await new Promise(res => setTimeout(res, 100));

                const notificationEvents = eventBus.events.filter(isPubkeySourceNotificationEvent);

                expect(notificationEvents.filter(e => e.message === `Connected to ${RELAY_URL1}`)).toHaveLength(1);
                expect(notificationEvents.filter(e => e.message === `Connected to ${RELAY_URL2}`)).toHaveLength(1);

                server1.close();
                server2.close();
            });

            it('it creates a Nostr subscription to each connection', async () => {
                const PORT1 = 8295;
                const PORT2 = 8296;
                const RELAY_URL1 = `ws://localhost:${String(PORT1)}`;
                const RELAY_URL2 = `ws://localhost:${String(PORT2)}`;
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

                server1.close();
                server2.close();
            });

            it('it publishes a notification of each subscription', async () => {
                const PORT1 = 8095;
                const PORT2 = 8096;
                const RELAY_URL1 = `ws://localhost:${String(PORT1)}`;
                const RELAY_URL2 = `ws://localhost:${String(PORT2)}`;
                const server1 = new WebSocketServer({ port: PORT1 });
                const server2 = new WebSocketServer({ port: PORT2 });
                const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL1, RELAY_URL2] });

                subscription = source.start({ filters: [] }).subscribe();

                await new Promise(res => setTimeout(res, 100));

                const notificationEvents = eventBus.events.filter(isPubkeySourceNotificationEvent);

                expect(notificationEvents.filter(e => e.message === `Subscribing to ${RELAY_URL1}/`)).toHaveLength(1);
                expect(notificationEvents.filter(e => e.message === `Subscribing to ${RELAY_URL2}/`)).toHaveLength(1);

                server1.close();
                server2.close();
            });

            describe('and a Nostr subscription is active', () => {
                it('it receives Nostr events and returns their pubkeys', async () => {
                    const RELAY_URLS = ['ws://localhost:12345', 'ws://localhost:12346'];
                    const PUBKEYS_FROM_RELAY1 = ['pubkey1', 'pubkey2'];
                    const PUBKEYS_FROM_RELAY2 = ['pubkey3'];

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
                        const events = url.includes('ws://localhost:12345') ? eventsFromRelay1 : url.includes('ws://localhost:12346') ? eventsFromRelay2 : [];

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

                });
            });


            describe('and a relay connection unexpectedly closes', () => {
                it('it publishes an error', async() => {
                    const RELAY_URL = 'ws://localhost:12345';
                    
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

                    const errorEvents = eventBus.events.filter(isPubkeySourceErrorEvent);

                    expect(connectionAttempts).toEqual(2);
                    expect(connectSpy).toHaveBeenCalledTimes(2);
                    expect(errorEvents).toHaveLength(1);
                    expect(errorEvents.some(e => e.message == `Disconnected from ${RELAY_URL} because: ${RELAY_URL} returned an error or closed the connection`)).toBeTruthy();

                });

                it('it closes any subscription and publishes a notification', async() => {
                    const RELAY_URL = 'ws://localhost:12345';
                    let connectionAttempts = 0;

                    vi.spyOn(Relay.prototype, 'connect').mockImplementation(function (): Promise<void> {
                        connectionAttempts++;

                        if (connectionAttempts === 1) {
                            setTimeout(() => {
                                this.onclose?.(); // eslint-disable-line
                                this.closeAllSubscriptions('relay connection errored'); // eslint-disable-line
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

                    const notificationEvents = eventBus.events.filter(isPubkeySourceNotificationEvent);

                    expect(notificationEvents.filter(e => e.message === `Unsubscribed from ${RELAY_URL}/`)).toHaveLength(1);
                });

                it('it attempts to reconnect after a configurable delay', async() => {
                    const RELAY_URL = 'ws://localhost:12345';
                    let connectionAttempts = 0;

                    const connectSpy = vi.spyOn(Relay.prototype, 'connect').mockImplementation(function (): Promise<void> {
                        connectionAttempts++;

                        if (connectionAttempts === 1) {
                            setTimeout(() => {
                                this.onclose?.(); // eslint-disable-line
                                this.closeAllSubscriptions('relay connection errored'); // eslint-disable-line
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

                });

                it('it publishes a notification of the reconnection attempt', async() => {
                    const RELAY_URL = 'ws://localhost:12345';
                    let connectionAttempts = 0;

                    vi.spyOn(Relay.prototype, 'connect').mockImplementation(function (): Promise<void> {
                        connectionAttempts++;

                        if (connectionAttempts === 1) {
                            setTimeout(() => {
                                this.onclose?.(); // eslint-disable-line
                                this.closeAllSubscriptions('relay connection errored'); // eslint-disable-line
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

                    const notificationEvents = eventBus.events.filter(isPubkeySourceNotificationEvent);

                    expect(notificationEvents.filter(e => e.message === `Connecting to ${RELAY_URL}`)).toHaveLength(2);
                    expect(notificationEvents.filter(e => e.message === `Connecting to ${RELAY_URL}`)).toHaveLength(2);

                });

                describe('and it reconnects', () => {
                    it('it publishes a notification', async() => {
                        const RELAY_URL = 'ws://localhost:12345';
                        let connectionAttempts = 0;

                        vi.spyOn(Relay.prototype, 'connect').mockImplementation(function (): Promise<void> {
                            connectionAttempts++;

                            if (connectionAttempts === 1) {
                                setTimeout(() => {
                                    this.onclose?.(); // eslint-disable-line
                                    this.closeAllSubscriptions('relay connection errored'); // eslint-disable-line
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

                        const notificationEvents = eventBus.events.filter(isPubkeySourceNotificationEvent);

                        expect(notificationEvents.filter(e => e.message === `Connected to ${RELAY_URL}`)).toHaveLength(2);
                        expect(notificationEvents.filter(e => e.message === `Connected to ${RELAY_URL}`)).toHaveLength(2);

                    });



                    it('it resubscribes to the connection and publishes a notification', async() => {
                        const RELAY_URL = 'ws://localhost:12345';
                        let connectionAttempts = 0;

                        vi.spyOn(Relay.prototype, 'connect').mockImplementation(function (): Promise<void> {
                            connectionAttempts++;

                            if (connectionAttempts === 1) {
                                setTimeout(() => {
                                    this.onclose?.(); // eslint-disable-line
                                    this.closeAllSubscriptions('relay connection errored'); // eslint-disable-line
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

                        const notificationEvents = eventBus.events.filter(isPubkeySourceNotificationEvent);
                        const subscriptionEvents = notificationEvents.filter(e => e.message === `Subscribing to ${RELAY_URL}/`);

                        expect(subscriptionEvents).toHaveLength(2);

                    });
                });
            });

            describe('and a relay closes a Nostr subscription', () => {
                it('it publishes an error event', async() => {
                    const PORT = 8099;
                    const RELAY_URL = `ws://localhost:${String(PORT)}`;
                    const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 50 });

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

                    const errorEvents = eventBus.events.filter(isPubkeySourceErrorEvent);

                    expect(errorEvents).toHaveLength(3);
                    expect(errorEvents.filter(e => e.message === 'Unsubscribed from ws://localhost:8099/ because: ws://localhost:8099/ closed the subscription')).toHaveLength(3);

                    server.close();
                });

                it('it resubscribes after a configurable delay', async() => {
                    const PORT = 8093;
                    const RELAY_URL = `ws://localhost:${String(PORT)}`;
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

                    server.close();
                });

                it('it publishes a notification of a resubscription', async() => {
                    const PORT = 8093;
                    const RELAY_URL = `ws://localhost:${String(PORT)}`;
                    const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 50 });
                    const subscriptions: Array<unknown[]> = [];
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

                    const notificationEvents = eventBus.events.filter(isPubkeySourceNotificationEvent);
                    const subscriptionEvents = notificationEvents.filter(e => e.message === `Subscribing to ${RELAY_URL}/`);

                    expect(subscriptionEvents).toHaveLength(3);

                    server.close();
                });
            });

            describe("and all subscribers unsubscribe", () => {
                it('it closes any Nostr subscription', async() => {
                    const PORT = 8293;
                    const RELAY_URL = `ws://localhost:${String(PORT)}`;
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

                    server.close();
                });

                it('it closes any relay connection', async() => {
                    const PORT = 8293;
                    const RELAY_URL = `ws://localhost:${String(PORT)}`;
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

                    server.close();
                });

                it('it publishes a notification of any disconnection', async() => {
                    const PORT = 8294;
                    const RELAY_URL = `ws://localhost:${String(PORT)}`;
                    const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 0 });
                    const subscriptions: Array<unknown[]> = [];

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
                    const subscription1 = obs.subscribe();
                    const subscription2 = obs.subscribe();

                    await new Promise((res) => setTimeout(res, 100));

                    subscription1.unsubscribe();
                    subscription2.unsubscribe();

                    await new Promise((res) => setTimeout(res, 100));

                    const notificationEvents = eventBus.events.filter(isPubkeySourceNotificationEvent);

                    expect(notificationEvents.filter(e => e.message === `Disconnected from ${RELAY_URL}`)).toHaveLength(1);

                    server.close();
                });

                it('it publishes a notification of any unsubscription', async() => {
                    const PORT = 8294;
                    const RELAY_URL = `ws://localhost:${String(PORT)}`;
                    const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 0 });
                    const subscriptions: Array<unknown[]> = [];

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
                    const subscription1 = obs.subscribe();
                    const subscription2 = obs.subscribe();

                    await new Promise((res) => setTimeout(res, 100));

                    subscription1.unsubscribe();
                    subscription2.unsubscribe();

                    await new Promise((res) => setTimeout(res, 100));

                    const notificationEvents = eventBus.events.filter(isPubkeySourceNotificationEvent);

                    expect(notificationEvents.filter(e => e.message === `Unsubscribed from ${RELAY_URL}/`)).toHaveLength(1);

                    server.close();
                });
            });

            describe('and it fails to connect to a relay', () => {
                describe('because the relay rejects the connection', () => {
                    it('it attempts to reconnect', async() => {
                        const PORT = 8093;
                        const RELAY_URL = `ws://localhost:${String(PORT)}`;
                        const connectSpy = vi.spyOn(Relay.prototype, 'connect');
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

                        server.close();
                    });
                });

                describe('because the relay times out', () => {
                    it('it attempts to reconnect', async() => {
                        const PORT = 8093;
                        const RELAY_URL = `ws://localhost:${String(PORT)}`;
                        const connectSpy = vi.spyOn(Relay.prototype, 'connect');
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

                        server.close();
                    });
                });

                describe('it always', () => {
                    it('publishes an error event', async () => {
                        const RELAY_URL = 'ws://localhost:12345';

                        vi.spyOn(Relay.prototype, 'connect').mockImplementation(() => Promise.reject(new Error('connection rejected')));

                        const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 10000 });

                        subscription = source.start({ filters: [] }).subscribe({
                            error: () => {},
                        });

                        await new Promise(res => setTimeout(res, 0));

                        const errorEvents = eventBus.events.filter(isPubkeySourceErrorEvent);

                        expect(errorEvents).toHaveLength(1);
                        expect(errorEvents.filter(e => e.message === `Disconnected from ${RELAY_URL} because: Failed to connect to ${RELAY_URL}: connection rejected`)).toHaveLength(1);

                    });

                    it('waits for a configurable delay before attempting to reconnect', async() => {
                        const RELAY_URLS = ['ws://localhost:12345'];
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

                    });

                    it('publishes a notification of the reconnection attempt', async() => {
                        const RELAY_URL = 'ws://localhost:12345';
                        const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 80 });

                        let connectionAttempts = 0;

                        vi.spyOn(Relay.prototype, 'connect').mockImplementation(function (): Promise<void> {
                            connectionAttempts++;

                            if (connectionAttempts === 1) {
                                this.connectionPromise = Promise.reject(new Error('connection rejected')); // eslint-disable-line
                                this._connected = false; // eslint-disable-line
                            } else {
                                this.connectionPromise = Promise.resolve(); // eslint-disable-line
                                this._connected = true; // eslint-disable-line
                            }

                            return this.connectionPromise as Promise<void>; // eslint-disable-line
                        });

                        subscription = source.start({ filters: [] }).subscribe({
                            error: () => {},
                        });

                        await new Promise(res => setTimeout(res, 100));

                        const notificationEvents = eventBus.events.filter(isPubkeySourceNotificationEvent);
                        const connectingEvents = notificationEvents.filter(e => e.message === `Connecting to ${RELAY_URL}`);

                        expect (connectingEvents).toHaveLength(2);
                    });

                    describe('after connecting', () => {
                        it('publishes a notification of reconnection', async() => {
                            const RELAY_URL = 'ws://localhost:12345';
                            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 80 });

                            let connectionAttempts = 0;

                            vi.spyOn(Relay.prototype, 'connect').mockImplementation(function (): Promise<void> {
                                connectionAttempts++;

                                if (connectionAttempts === 1) {
                                    this.connectionPromise = Promise.reject(new Error('connection rejected')); // eslint-disable-line
                                    this._connected = false; // eslint-disable-line
                                } else {
                                    this.connectionPromise = Promise.resolve(); // eslint-disable-line
                                    this._connected = true; // eslint-disable-line
                                }

                                return this.connectionPromise as Promise<void>; // eslint-disable-line
                            });

                            subscription = source.start({ filters: [] }).subscribe({
                                error: () => {},
                            });

                            await new Promise(res => setTimeout(res, 100));

                            const notificationEvents = eventBus.events.filter(isPubkeySourceNotificationEvent);
                            const connectedEvents = notificationEvents.filter(e => e.message === `Connected to ${RELAY_URL}`);

                            expect (connectedEvents).toHaveLength(1);
                        });

                        it('creates a Nostr subscription and publishes a notification', async () => {
                            const RELAY_URL = 'ws://localhost:12345';
                            const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 80 });

                            let connectionAttempts = 0;

                            vi.spyOn(Relay.prototype, 'connect').mockImplementation(function (): Promise<void> {
                                connectionAttempts++;

                                if (connectionAttempts === 1) {
                                    this.connectionPromise = Promise.reject(new Error('connection rejected')); // eslint-disable-line
                                    this._connected = false; // eslint-disable-line
                                } else {
                                    this.connectionPromise = Promise.resolve(); // eslint-disable-line
                                    this._connected = true; // eslint-disable-line
                                }

                                return this.connectionPromise as Promise<void>; // eslint-disable-line
                            });

                            subscription = source.start({ filters: [] }).subscribe({
                                error: () => {},
                            });

                            await new Promise(res => setTimeout(res, 100));

                            const notificationEvents = eventBus.events.filter(isPubkeySourceNotificationEvent);
                            const connectingEvents = notificationEvents.filter(e => e.message === `Subscribing to ${RELAY_URL}/`);

                            expect (connectingEvents).toHaveLength(1);
                        });
                    });
                });
            });

            describe('multiple times concurrently', () => {
                it('it maintains a single connection per relay', async() => {
                    const PORT = 8293;
                    const RELAY_URL = `ws://localhost:${String(PORT)}`;
                    const server = new WebSocketServer({ port: PORT });
                    const source = new NostrToolsPubkeySource({ eventBus, relayURLs: [RELAY_URL], retryDelay: 0 });
                    const obs = source.start({ filters: [ { kinds: [1] } ] });

                    obs.subscribe();
                    obs.subscribe();

                    await new Promise((res) => setTimeout(res, 100));

                    expect(server.clients.size).toEqual(1);

                    server.close();
                });

                it('it maintains a single Nostr subscription to each connected relay', async() => {
                    const PORT = 8293;
                    const RELAY_URL = `ws://localhost:${String(PORT)}`;
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

                    server.close();
                });

                it('it shares Nostr events among all subscriptions', async () => {
                    const RELAY_URLS = ['ws://localhost:12345', 'ws://localhost:12346'];
                    const PUBKEYS_FROM_RELAY1 = ['pubkey1', 'pubkey2'];
                    const PUBKEYS_FROM_RELAY2 = ['pubkey3'];
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
                        const events = url.includes('ws://localhost:12345') ? eventsFromRelay1 : url.includes('ws://localhost:12346') ? eventsFromRelay2 : [];

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
                });

                describe("and some subscribers unsubscribe", () => {
                    it('it keeps the Nostr subscription open', async() => {
                        const PORT = 8293;
                        const RELAY_URL = `ws://localhost:${String(PORT)}`;
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
                        const subscription3 = obs.subscribe();
                        obs.subscribe();

                        await new Promise((res) => setTimeout(res, 100));

                        subscription3.unsubscribe();

                        await new Promise((res) => setTimeout(res, 100));

                        expect(subscriptions).toStrictEqual(expectedSubscriptions);

                        server.close();
                    });
                });
            });
        });
    });
});
