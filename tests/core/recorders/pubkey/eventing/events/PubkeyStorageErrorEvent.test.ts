import { describe, it, expect } from 'vitest';
import { PubkeyStorageErrorEvent } from '../../../../../../src/core/recorders/pubkey/eventing/events/PubkeyStorageErrorEvent.js';
import { IDomainErrorEventData } from '../../../../../../src/core/eventing/data/IDomainErrorEventData.js';
import { AbstractDomainErrorEvent } from '../../../../../../src/core/eventing/events/AbstractDomainErrorEvent.js';
import { AbstractDomainEvent } from '../../../../../../src/core/eventing/events/AbstractDomainEvent.js';

describe('PubkeyStorageErrorEvent', () => {
    const sampleCreatedBy = 'TestCreator';

    const sampleData: IDomainErrorEventData = {
        source: 'PubkeyStorage',
        message: 'Unable to persist pubkey – disk full'
    };

    describe('constructor()', () => {
        it('initializes createdBy, createdOn and data', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(event.createdBy).toBe(sampleCreatedBy);
            expect(event.createdOn).toBeDefined();
            expect(event.data).toBe(sampleData);
        });

        it('sets createdOn to current time', () => {
            const before = Date.now();
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);
            const after = Date.now();

            expect(event.createdOn.getTime()).toBeGreaterThanOrEqual(before);
            expect(event.createdOn.getTime()).toBeLessThanOrEqual(after);
        });

        it('leaves publishedBy and publishedOn as undefined', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(event.publishedBy).toBeUndefined();
            expect(event.publishedOn).toBeUndefined();
        });
        
        it('accepts empty source', () => {
            const data: IDomainErrorEventData = {
                source: '',
                message: sampleData.message,
            };

            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, data);

            expect(event.source).toBe('');
        });

        it('accepts empty message', () => {
            const data: IDomainErrorEventData = {
                source: sampleData.source,
                message: '',
            };

            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, data);

            expect(event.message).toBe('');
        });
    });

    describe('setPublishedBy()', () => {
        it('sets publishedBy', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            event.setPublishedBy('publisher');

            expect(event.publishedBy).toBe('publisher');
        });

        it('accepts an empty string', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            event.setPublishedBy('');

            expect(event.publishedBy).toBe('');
        });

        it('does not change publishedBy if already set', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            event.setPublishedBy('FirstPublisher');
            event.setPublishedBy('SecondPublisher');

            expect(event.publishedBy).toBe('FirstPublisher');
        });
    });

    describe('published()', () => {
        it('sets publishedOn to current date and time', () => {
            expect.assertions(3);

            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);
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
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            event.published();

            const firstPublishedOn = event.publishedOn;

            await new Promise(res => setTimeout(res, 20));

            event.published();

            expect(event.publishedOn).toBe(firstPublishedOn);
        });
    });

    describe('.source', () => {
        it('is public', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(event.source).toBe(sampleData.source);
        });

        it('is immutable', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(() => {
                // @ts-expect-error "this should be a type error"
                event.source = '';
            }).toThrow(TypeError);
        });
    });

    describe('.message', () => {
        it('is public', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(event.message).toBe(sampleData.message);
        });

        it('is immutable', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(() => {
                // @ts-expect-error "this should be a type error"
                event.message = '';
            }).toThrow(TypeError);
        });
    });

    describe('.error', () => {
        it('is public', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(event.error).toBe(`${sampleData.source} error: ${sampleData.message}`);
        });

        it('is immutable', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(() => {
                // @ts-expect-error "this should be a type error"
                event.error = '';
            }).toThrow(TypeError);
        });
    });

    describe('.data', () => {
        it('is public', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(event.data).toBe(sampleData);
        });

        it('is immutable', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(() => {
                // @ts-expect-error "this should be a type error"
                event.data = {};
            }).toThrow(TypeError);
        });

        it('its properties are immutable', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(() => {
                event.data.source = 'mutated-source';
            }).toThrow(TypeError);

            expect(() => {
                event.data.message = 'mutated-message';
            }).toThrow(TypeError);
        });
    });

    describe('.createdBy', () => {
        it('is public', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(event.createdBy).toBe(sampleCreatedBy);
        });

        it('is immutable', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(() => {
                // @ts-expect-error "this should be a type error"
                event.createdBy = '';
            }).toThrow(TypeError);
        });
    });

    describe('.createdOn', () => {
        it('is public', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(event.createdOn).toBeInstanceOf(Date);
        });

        it('its reference is immutable', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            expect(() => {
                // @ts-expect-error "this should be a type error"
                event.createdOn = new Date();
            }).toThrow(TypeError);
        });

        it('its properties are mutable', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            event.createdOn.setFullYear(0);

            expect(event.createdOn.getFullYear()).toBe(0);
        });
    });

    describe('.publishedBy', () => {
        it('is public', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);
            event.setPublishedBy('publisher');

            expect(event.publishedBy).toBe('publisher');
        });

        it('is immutable', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);
            event.setPublishedBy('publisher');

            expect(() => {
                // @ts-expect-error "this should be a type error"
                event.publishedBy = '';
            }).toThrow(TypeError);
        });
    });

    describe('.publishedOn', () => {
        it('is public', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            event.published();

            expect(event.publishedOn).toBeInstanceOf(Date);
        });

        it('its reference is immutable', () => {
            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            event.published();

            expect(() => {
                // @ts-expect-error "this should be a type error"
                event.publishedOn = new Date();
            }).toThrow(TypeError);
        });

        it('its properties are mutable', () => {
            expect.assertions(1);

            const event = new PubkeyStorageErrorEvent(sampleCreatedBy, sampleData);

            event.published();

            if (event.publishedOn) {
                event.publishedOn.setFullYear(0);

                expect(event.publishedOn.getFullYear()).toBe(0);
            }
        });
    });
});
