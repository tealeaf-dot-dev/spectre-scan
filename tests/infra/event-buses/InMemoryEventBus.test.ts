import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PubkeyFoundEvent } from '../../../src/core/recorders/pubkey/eventing/events/PubkeyFoundEvent.js';
import { IPubkeyEventData } from '../../../src/core/recorders/pubkey/eventing/data/IPubkeyEventData.js';
import { Pubkey } from '../../../src/core/data/types.js';
import { IEventBusPort } from '../../../src/core/eventing/ports/event-bus/IEventBusPort.js';

let InMemoryEventBus: typeof import('../../../src/infra/event-buses/InMemoryEventBus.js').InMemoryEventBus;

function createTestEvent(pubkey: Pubkey = 'test-pubkey'): PubkeyFoundEvent {
    const eventData: IPubkeyEventData = {
        pubkey,
        date: new Date('2024-01-01T12:00:00.000Z')
    };

    return new PubkeyFoundEvent('TestCreator', eventData);
}

beforeEach(async () => {
    vi.resetModules();
    ({ InMemoryEventBus: InMemoryEventBus } = await import('../../../src/infra/event-buses/InMemoryEventBus.js'));
});

describe('InMemoryEventBus', () => {
    describe('create()', () => {
        it('should return an InMemoryEventBus instance', () => {
            const instance = InMemoryEventBus.create();

            expect(instance).toBeInstanceOf(InMemoryEventBus);
        });

        it('singleton behavior: should return the same instance on multiple calls', () => {
            const instance1 = InMemoryEventBus.create();
            const instance2 = InMemoryEventBus.create();
            const instance3 = InMemoryEventBus.create();

            expect(instance1).toBe(instance2);
            expect(instance2).toBe(instance3);
            expect(instance1).toBe(instance3);
        });
    });

    describe('publish()', () => {
        let eventBus: IEventBusPort;

        beforeEach(() => {
            eventBus = InMemoryEventBus.create();
        });

        it('publishes events to a subscriber', () => {
            const mockSubscriber = vi.fn();
            const testEvent1 = createTestEvent('pubkey1');
            const testEvent2 = createTestEvent('pubkey2');

            eventBus.events$.subscribe(mockSubscriber);
            eventBus.publish(testEvent1);
            eventBus.publish(testEvent2);

            expect(mockSubscriber).toHaveBeenCalledTimes(2);
            expect(mockSubscriber).toHaveBeenNthCalledWith(1, testEvent1);
            expect(mockSubscriber).toHaveBeenNthCalledWith(2, testEvent2);
        });

        it('multicasts to multiple subscribers', () => {
            const mockSubscriber1 = vi.fn();
            const mockSubscriber2 = vi.fn();
            const mockSubscriber3 = vi.fn();
            const testEvent1 = createTestEvent('pubkey1');
            const testEvent2 = createTestEvent('pubkey2');

            eventBus.events$.subscribe(mockSubscriber1);
            eventBus.events$.subscribe(mockSubscriber2);
            eventBus.events$.subscribe(mockSubscriber3);

            eventBus.publish(testEvent1);
            eventBus.publish(testEvent2);

            expect(mockSubscriber1).toHaveBeenCalledTimes(2);
            expect(mockSubscriber1).toHaveBeenCalledWith(testEvent1);
            expect(mockSubscriber1).toHaveBeenCalledWith(testEvent2);
            expect(mockSubscriber2).toHaveBeenCalledTimes(2);
            expect(mockSubscriber2).toHaveBeenCalledWith(testEvent1);
            expect(mockSubscriber2).toHaveBeenCalledWith(testEvent2);
            expect(mockSubscriber3).toHaveBeenCalledTimes(2);
            expect(mockSubscriber2).toHaveBeenCalledWith(testEvent1);
            expect(mockSubscriber2).toHaveBeenCalledWith(testEvent2);
        });

        it('does not throw when publishing with no subscribers', () => {
            const testEvent = createTestEvent();

            expect(() => {
                eventBus.publish(testEvent);
            }).not.toThrow();
        });

        it('maintains event publication sequence', () => {
            expect.assertions(101);

            const mockSubscriber = vi.fn();

            eventBus.events$.subscribe(mockSubscriber);

            for (let i = 1; i <= 100; i++) {
                eventBus.publish(createTestEvent(`pubkey${String(i)}`));
            }

            expect(mockSubscriber).toHaveBeenCalledTimes(100);
 
            for (let i = 1; i <= 100; i++) {
                expect(mockSubscriber).toHaveBeenNthCalledWith(1, createTestEvent(`pubkey${String(i)}`));
            }
        });

        it('calls event.published() when publishing', () => {
            const testEvent = createTestEvent();
            const publishedSpy = vi.spyOn(testEvent, 'published');

            eventBus.publish(testEvent);

            expect(publishedSpy).toHaveBeenCalledTimes(1);
        });

        it('replays events to late subscribers', () => {
            const mockSubscriber = vi.fn();
            const testEvent1 = createTestEvent('pubkey1');
            const testEvent2 = createTestEvent('pubkey2');

            eventBus.publish(testEvent1);
            eventBus.publish(testEvent2);
            eventBus.events$.subscribe(mockSubscriber);

            expect(mockSubscriber).toHaveBeenCalledTimes(2);
            expect(mockSubscriber).toHaveBeenNthCalledWith(1, testEvent1);
            expect(mockSubscriber).toHaveBeenNthCalledWith(2, testEvent2);
        });
    });

    describe('.event$', () => {
        let eventBus: IEventBusPort;

        beforeEach(() => {
            eventBus = InMemoryEventBus.create();
        });

        it('is immutable', () => {
            expect(() => {
                // @ts-expect-error "this should be a type error"
                eventBus.events$ = null;
            }).toThrow(TypeError);
        });
    });
});
