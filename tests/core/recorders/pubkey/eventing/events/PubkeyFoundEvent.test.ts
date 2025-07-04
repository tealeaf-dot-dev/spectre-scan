import { describe, it, expect } from 'vitest';
import { PubkeyFoundEvent } from '../../../../../../src/core/recorders/pubkey/eventing/events/PubkeyFoundEvent.js';
import { IPubkeyEventData } from '../../../../../../src/core/recorders/pubkey/eventing/data/IPubkeyEventData.js';
import { Pubkey } from '../../../../../../src/core/data/types.js';

describe('PubkeyFoundEvent', () => {
    const sampleCreatedBy = 'TestCreator';

    const sampleData: IPubkeyEventData = {
        pubkey: 'abc123def456',
        date: new Date('2024-01-01T12:00:00.000Z'),
    };

    describe('constructor()', () => {
        it('initializes createdBy, createdOn and data', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            expect(event.createdBy).toBe(sampleCreatedBy);
            expect(event.createdOn).toBeDefined();
            expect(event.data).toBe(sampleData);
        });

        it('sets createdOn to current time', () => {
            const before = Date.now();
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);
            const after = Date.now();

            expect(event.createdOn.getTime()).toBeGreaterThanOrEqual(before);
            expect(event.createdOn.getTime()).toBeLessThanOrEqual(after);
        });

        it('leaves publishedBy and publishedOn as undefined', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            expect(event.publishedBy).toBeUndefined();
            expect(event.publishedOn).toBeUndefined();
        });
        
        it('accepts empty pubkey', () => {
            const emptyPubkey: Pubkey = '';

            const data: IPubkeyEventData = {
                pubkey: emptyPubkey,
                date: sampleData.date,
            };

            const event = new PubkeyFoundEvent(sampleCreatedBy, data);

            expect(event.pubkey).toBe('');
        });

        it('accepts future dates', () => {
            const futureDate = new Date('2099-12-31T23:59:59.999Z');

            const data: IPubkeyEventData = {
                pubkey: sampleData.pubkey,
                date: futureDate,
            };

            const event = new PubkeyFoundEvent(sampleCreatedBy, data);

            expect(event.date).toBe(futureDate);
        });
    });

    describe('setPublishedBy()', () => {
        it('sets publishedBy', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            event.setPublishedBy('publisher');

            expect(event.publishedBy).toBe('publisher');
        });

        it('accepts an empty string', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            event.setPublishedBy('');

            expect(event.publishedBy).toBe('');
        });

        it('does not change publishedBy if already set', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            event.setPublishedBy('FirstPublisher');
            event.setPublishedBy('SecondPublisher');

            expect(event.publishedBy).toBe('FirstPublisher');
        });
    });

    describe('published()', () => {
        it('sets publishedOn to current date and time', () => {
            expect.assertions(3);

            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);
            const before = Date.now();

            event.published();

            const after = Date.now();

            expect(event.publishedOn).toBeInstanceOf(Date);

            if (event.publishedOn) {
                expect(event.publishedOn.getTime()).toBeGreaterThanOrEqual(before);
                expect(event.publishedOn.getTime()).toBeLessThanOrEqual(after);
            }
        });

        it('does not change publishedOn if already set', async () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            event.published();

            const firstPublishedOn = event.publishedOn;

            await new Promise(res => setTimeout(res, 20));

            event.published();

            expect(event.publishedOn).toBe(firstPublishedOn);
        });
    });

    describe('.pubkey', () => {
        it('is public', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            expect(event.pubkey).toBe(sampleData.pubkey);
        });

        it('is immutable', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            expect(() => {
                // @ts-expect-error "there should be a type error"
                event.pubkey = '';
            }).toThrow(TypeError);
        });
    });

    describe('.date', () => {
        it('is public', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            expect(event.date).toBe(sampleData.date);
        });

        it('its reference is immutable', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            expect(() => {
                // @ts-expect-error "there should be a type error"
                event.date = new Date();
            }).toThrow(TypeError);
        });

        it('its properties are mutable', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            event.date.setFullYear(0);

            expect(event.date.getFullYear()).toBe(0);
        });
    });

    describe('.data', () => {
        it('is public', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            expect(event.data).toBe(sampleData);
        });

        it('is immutable', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            expect(() => {
                // @ts-expect-error "there should be a type error"
                event.data = {};
            }).toThrow(TypeError);
        });

        it('its properties are immutable', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            expect(() => {
                event.data.pubkey = 'mutated-pubkey';
            }).toThrow(TypeError);

            expect(() => {
                event.data.date = new Date();
            }).toThrow(TypeError);
        });
    });


    describe('.createdBy', () => {
        it('is public', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            expect(event.createdBy).toBe(sampleCreatedBy);
        });

        it('is immutable', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            expect(() => {
                // @ts-expect-error "there should be a type error"
                event.createdBy = '';
            }).toThrow(TypeError);
        });
    });

    describe('.createdOn', () => {
        it('is public', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            expect(event.createdOn).toBeInstanceOf(Date);
        });

        it('its reference is immutable', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            expect(() => {
                // @ts-expect-error "there should be a type error"
                event.createdOn = new Date();
            }).toThrow(TypeError);
        });

        it('its properties are mutable', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            event.createdOn.setFullYear(0);

            expect(event.date.getFullYear()).toBe(0);
        });
    });

    describe('.publishedBy', () => {
        it('is public', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);
            event.setPublishedBy('publisher');

            expect(event.publishedBy).toBe('publisher');
        });

        it('is immutable', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);
            event.setPublishedBy('publisher');

            expect(() => {
                // @ts-expect-error "there should be a type error"
                event.publishedBy = '';
            }).toThrow(TypeError);
        });
    });

    describe('.publishedOn', () => {
        it('is public', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            event.published();

            expect(event.publishedOn).toBeInstanceOf(Date);
        });

        it('its reference is immutable', () => {
            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            event.published();

            expect(() => {
                // @ts-expect-error "there should be a type error"
                event.publishedOn = new Date();
            }).toThrow(TypeError);
        });

        it('its properties are mutable', () => {
            expect.assertions(1);

            const event = new PubkeyFoundEvent(sampleCreatedBy, sampleData);

            event.published();

            if (event.publishedOn) {
                event.publishedOn.setFullYear(0);

                expect(event.publishedOn.getFullYear()).toBe(0);
            }
        });
    });
});
