import { describe, it, expect, vi, afterEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Subject, of } from 'rxjs';
import { IEventBusPort } from '../../../../src/core/eventing/ports/event-bus/IEventBusPort.js';
import { PubkeyRecorder } from '../../../../src/core/recorders/pubkey/PubkeyRecorder.js';
import { IDomainEvent } from '../../../../src/core/eventing/events/IDomainEvent.js';
import { Pubkey } from '../../../../src/core/data/types.js';
import { AbstractDomainEvent } from '../../../../src/core/eventing/events/AbstractDomainEvent.js';
import { RECORDER_STATUS } from '../../../../src/core/recorders/generic/recorder-status.js';
import { IPubkeyStoragePort } from '../../../../src/core/recorders/pubkey/ports/storage/IPubkeyStoragePort.js';
import dayjs from 'dayjs';
import { PubkeyStoredEvent } from '../../../../src/core/recorders/pubkey/eventing/events/PubkeyStoredEvent.js';
import { IPubkeyStoragePortResponse } from '../../../../src/core/recorders/pubkey/ports/storage/IPubkeyStoragePortResponse.js';
import { PubkeyFoundEvent } from '../../../../src/core/recorders/pubkey/eventing/events/PubkeyFoundEvent.js';
import { PubkeyStorageErrorEvent } from '../../../../src/core/recorders/pubkey/eventing/events/PubkeyStorageErrorEvent.js';
import { IDomainEventData } from '../../../../src/core/eventing/data/IDomainEventData.js';
import { left, right } from 'fp-ts/lib/Either.js';

afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
});

function createRecorder() {
    const storage = mock<IPubkeyStoragePort>();
    const eventSubject = new Subject<IDomainEvent<IDomainEventData>>();

    const eventBus: IEventBusPort = {
        events$: eventSubject.asObservable(),
        publish: vi.fn(),
    };

    const recorder = new PubkeyRecorder(eventBus, [storage]);

    return { recorder, storage, eventSubject, eventBus };
}

function createRecorderWithMultipleStorages() {
    const storage1 = mock<IPubkeyStoragePort>();
    const storage2 = mock<IPubkeyStoragePort>();
    const eventSubject = new Subject<IDomainEvent<IDomainEventData>>();

    const eventBus: IEventBusPort = {
        events$: eventSubject.asObservable(),
        publish: vi.fn(),
    };

    const recorder = new PubkeyRecorder(eventBus, [storage1, storage2]);

    return { recorder, storage1, storage2, eventSubject, eventBus };
}

function createStorageSuccessResponse(pubkey: Pubkey, date: Date, storageName: string): IPubkeyStoragePortResponse {
    const evt = new PubkeyStoredEvent('PubkeyStorage', { pubkey, date, storageName });

    return of(right<PubkeyStorageErrorEvent, PubkeyStoredEvent>(evt));
}

function createStorageFailureResponse(storageName: string, errorMsg: string): IPubkeyStoragePortResponse {
    const evt = new PubkeyStorageErrorEvent('PubkeyStorage', { source: storageName, message: errorMsg });

    return of(left<PubkeyStorageErrorEvent, PubkeyStoredEvent>(evt));
}

const storageName = 'PubkeyStorage';

describe('PubkeyRecorder', () => {

    describe('constructor()', () => {
        it('initializes properties', () => {
            const { storage, eventBus, recorder } = createRecorder();

            expect(recorder.eventBus).toBe(eventBus);
            expect(recorder.storages).toStrictEqual([storage]);
        });

        it('sets the status to never started', () => {
            const { recorder } = createRecorder();

            expect(recorder.status).toEqual(RECORDER_STATUS.NeverStarted);
        });
    });

    describe('start()', () => {
        it('sets the status to started', () => {
            const { recorder } = createRecorder();
            recorder.start();

            expect(recorder.status).toEqual(RECORDER_STATUS.Started);
        });

        it('receives pubkeys from the event stream and stores them', async () => {
            const { recorder, storage, eventSubject } = createRecorder();
            const date = dayjs();
            const pubkey1 = 'abc123';
            const pubkey2 = 'def456';
            const pubkey3 = 'ghi789';

            recorder.start();

            storage.store.mockReturnValue(createStorageSuccessResponse(pubkey1, date, storageName));
            eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey1, date, }));
            storage.store.mockReturnValue(createStorageSuccessResponse(pubkey2, date, storageName));
            eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey2, date, }));
            storage.store.mockReturnValue(createStorageSuccessResponse(pubkey3, date, storageName));
            eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey3, date, }));

            await Promise.resolve();

            expect(recorder.status).toEqual(RECORDER_STATUS.Started);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkey1, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkey2, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkey3, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.store).toHaveBeenCalledTimes(3);
        });

        it('stores pubkeys in multiple storages', async () => {
            const { recorder, storage1, storage2, eventSubject } = createRecorderWithMultipleStorages();
            const date = dayjs();
            const pubkey1 = 'abc123';
            const pubkey2 = 'def456';
            const pubkey3 = 'ghi789';

            recorder.start();

            storage1.store.mockReturnValue(createStorageSuccessResponse(pubkey1, date, storageName));
            storage2.store.mockReturnValue(createStorageSuccessResponse(pubkey1, date, storageName));
            eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey1, date, }));
            storage1.store.mockReturnValue(createStorageSuccessResponse(pubkey2, date, storageName));
            storage2.store.mockReturnValue(createStorageSuccessResponse(pubkey2, date, storageName));
            eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey2, date, }));
            storage1.store.mockReturnValue(createStorageSuccessResponse(pubkey3, date, storageName));
            storage2.store.mockReturnValue(createStorageSuccessResponse(pubkey3, date, storageName));
            eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey3, date, }));

            await Promise.resolve();

            expect(recorder.status).toEqual(RECORDER_STATUS.Started);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage1.store).toHaveBeenCalledWith({ pubkey: pubkey1, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage2.store).toHaveBeenCalledWith({ pubkey: pubkey1, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage1.store).toHaveBeenCalledWith({ pubkey: pubkey2, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage2.store).toHaveBeenCalledWith({ pubkey: pubkey2, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage1.store).toHaveBeenCalledWith({ pubkey: pubkey3, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage2.store).toHaveBeenCalledWith({ pubkey: pubkey3, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage1.store).toHaveBeenCalledTimes(3);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage2.store).toHaveBeenCalledTimes(3);
        });

        it('ignores non-pubkey events', async () => {
            const { recorder, storage, eventSubject } = createRecorder();
            const date = dayjs();
            const pubkey1 = 'abc123';
            const pubkey2 = 'def456';
            const pubkey3 = 'ghi789';

            interface ISomeEventData extends IDomainEventData {
                pubkey: Pubkey;
                date: Date;
            }

            class SomeEvent extends AbstractDomainEvent<ISomeEventData> {

                constructor(pubkey: Pubkey, date: Date) {
                    super('SomeClass', { pubkey, date });
                }

                get pubkey(): Pubkey {

                    return this.data.pubkey;
                }

                get date(): Date {

                    return this.data.date;
                }
            }

            recorder.start();

            storage.store.mockReturnValue(createStorageSuccessResponse(pubkey1, date, storageName));
            eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey1, date }));
            eventSubject.next(new SomeEvent(pubkey2, date));
            storage.store.mockReturnValue(createStorageSuccessResponse(pubkey3, date, storageName));
            eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey3, date }));

            await Promise.resolve();

            expect(recorder.status).toEqual(RECORDER_STATUS.Started);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkey1, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.store).not.toHaveBeenCalledWith({ pubkey: pubkey2, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkey3, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.store).toHaveBeenCalledTimes(2);
        });

        it('publishes storage successes', async () => {
            const { recorder, storage, eventSubject, eventBus } = createRecorder();
            const date = dayjs();
            const pubkey1 = 'abc123';

            storage.store.mockReturnValue(createStorageSuccessResponse(pubkey1, date, storageName));

            recorder.start();
            eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey1, date }));

            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(eventBus.publish).toHaveBeenCalledTimes(1);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(eventBus.publish).toHaveBeenCalledWith(expect.any(PubkeyStoredEvent));
        });

        it('publishes successes from multiple storages', async () => {
            const { recorder, storage1, storage2, eventSubject, eventBus } = createRecorderWithMultipleStorages();
            const date = dayjs();
            const pubkey1 = 'abc123';

            recorder.start();

            storage1.store.mockReturnValue(createStorageSuccessResponse(pubkey1, date, storageName));
            storage2.store.mockReturnValue(createStorageSuccessResponse(pubkey1, date, storageName));
            eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey1, date }));

            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(eventBus.publish).toHaveBeenCalledTimes(2);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(eventBus.publish).toHaveBeenNthCalledWith(1, expect.any(PubkeyStoredEvent));
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(eventBus.publish).toHaveBeenNthCalledWith(2, expect.any(PubkeyStoredEvent));
        });

        it('publishes storage errors', async () => {
            const { recorder, storage, eventSubject, eventBus } = createRecorder();
            const date = dayjs();
            const pubkey = 'abc123';
            const errorMsg = 'storage failure';

            recorder.start();

            storage.store.mockReturnValue(createStorageFailureResponse(storageName, errorMsg));
            eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey, date, }));

            await Promise.resolve();
            await Promise.resolve();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(eventBus.publish).toHaveBeenCalledTimes(1);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(eventBus.publish).toHaveBeenCalledWith(expect.any(PubkeyStorageErrorEvent));
        });

        it('publishes errors from multiple storages', async () => {
            const { recorder, storage1, storage2, eventSubject, eventBus } = createRecorderWithMultipleStorages();
            const date = dayjs();
            const pubkey = 'abc123';
            const errorMsg = 'storage failure';

            recorder.start();

            storage1.store.mockReturnValue(createStorageFailureResponse(storageName, errorMsg));
            storage2.store.mockReturnValue(createStorageFailureResponse(storageName, errorMsg));
            eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey, date, }));

            await Promise.resolve();
            await Promise.resolve();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(eventBus.publish).toHaveBeenCalledTimes(2);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(eventBus.publish).toHaveBeenNthCalledWith(1, expect.any(PubkeyStorageErrorEvent));
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(eventBus.publish).toHaveBeenNthCalledWith(2, expect.any(PubkeyStorageErrorEvent));
        });

        it('continues recording after receiving a storage error', async () => {
            const { recorder, storage, eventSubject, eventBus } = createRecorder();
            const date     = dayjs();
            const pubkey1  = 'error-key';
            const pubkey2  = 'next-key';
            const errorMsg = 'db failure';
            const pubkeyFoundEvent1 = new PubkeyFoundEvent('PubkeyScanner', { pubkey: pubkey1, date });
            const pubkeyFoundEvent2 = new PubkeyFoundEvent('PubkeyScanner', { pubkey: pubkey2, date, });

            recorder.start();

            storage.store.mockReturnValue(createStorageFailureResponse(storageName, errorMsg));
            eventSubject.next(pubkeyFoundEvent1);
            storage.store.mockReturnValue(createStorageSuccessResponse(pubkey2, date, storageName));
            eventSubject.next(pubkeyFoundEvent2);

            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            expect(recorder.status).toEqual(RECORDER_STATUS.Started);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.store).toHaveBeenCalledTimes(2);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkey1, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkey2, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(eventBus.publish).toHaveBeenCalledTimes(2);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(eventBus.publish).toHaveBeenNthCalledWith(1, expect.any(PubkeyStorageErrorEvent));
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(eventBus.publish).toHaveBeenNthCalledWith(2, expect.any(PubkeyStoredEvent));
        });

        describe('when the stream has already been started', () => {
            it('does nothing', async () => {
                const { recorder, storage, eventSubject } = createRecorder();
                const date = dayjs();
                const pubkey1 = 'abc123';
                const pubkey2 = 'def456';
                const pubkey3 = 'ghi789';

                recorder.start();
                recorder.start();

                storage.store.mockReturnValue(createStorageSuccessResponse(pubkey1, date, storageName));
                eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey1, date }));
                storage.store.mockReturnValue(createStorageSuccessResponse(pubkey2, date, storageName));
                eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey2, date }));
                storage.store.mockReturnValue(createStorageSuccessResponse(pubkey3, date, storageName));
                eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey3, date }));

                await Promise.resolve();

                expect(recorder.status).toEqual(RECORDER_STATUS.Started);
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkey1, date });
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkey2, date });
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkey3, date });
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(storage.store).toHaveBeenCalledTimes(3);
            });
        });

        describe('when the stream has been stopped', () => {
            it('restarts the stream', async () => {
                const { recorder, storage, eventSubject } = createRecorder();
                const date = dayjs();
                const pubkey1 = 'abc123';
                const pubkey2 = 'def456';
                const pubkey3 = 'ghi789';

                recorder.start();

                storage.store.mockReturnValue(createStorageSuccessResponse(pubkey1, date, storageName));
                eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey1, date }));
                storage.store.mockReturnValue(createStorageSuccessResponse(pubkey2, date, storageName));
                eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey2, date }));

                recorder.stop();
                recorder.start();

                storage.store.mockReturnValue(createStorageSuccessResponse(pubkey3, date, storageName));
                eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkey3, date }));

                await Promise.resolve();

                expect(recorder.status).toEqual(RECORDER_STATUS.Started);
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkey1, date });
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkey2, date });
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkey3, date });
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(storage.store).toHaveBeenCalledTimes(3);
            });

            it('sets the status to started', () => {
                const { recorder } = createRecorder();
                recorder.start();
                recorder.stop();
                recorder.start();

                expect(recorder.status).toEqual(RECORDER_STATUS.Started);
            });
        });
    });

    describe('stop()', () => {
        it('sets the status to stopped', () => {
            const { recorder } = createRecorder();
            recorder.start();
            recorder.stop();

            expect(recorder.status).toEqual(RECORDER_STATUS.Stopped);
        });

        it('stops storing pubkeys', async () => {
            const { recorder, storage, eventSubject } = createRecorder();
            const date = dayjs();
            const pubkeyBeforeStop = 'before-stop';
            const pubkeyAfterStop  = 'after-stop';

            recorder.start();

            storage.store.mockReturnValue(createStorageSuccessResponse(pubkeyBeforeStop, date, storageName));
            eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkeyBeforeStop, date }));

            await Promise.resolve();

            recorder.stop();

            eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkeyAfterStop, date }));

            await Promise.resolve();

            expect(recorder.status).toEqual(RECORDER_STATUS.Stopped);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.store).toHaveBeenCalledTimes(1);
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkeyBeforeStop, date });
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.store).not.toHaveBeenCalledWith({ pubkey: pubkeyAfterStop, date });
        });

        describe('when the stream is already stopped', () => {
            it('does nothing', async () => {
                const { recorder, storage, eventSubject } = createRecorder();
                const date = dayjs();
                const pubkeyBeforeStop = 'before-stop';
                const pubkeyAfterStop  = 'after-stop';

                recorder.start();

                storage.store.mockReturnValue(createStorageSuccessResponse(pubkeyBeforeStop, date, storageName));
                eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkeyBeforeStop, date }));

                await Promise.resolve();

                recorder.stop();
                recorder.stop();

                eventSubject.next(new PubkeyFoundEvent('PubkeySource', { pubkey: pubkeyAfterStop, date }));

                await Promise.resolve();

                expect(recorder.status).toEqual(RECORDER_STATUS.Stopped);
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(storage.store).toHaveBeenCalledTimes(1);
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(storage.store).toHaveBeenCalledWith({ pubkey: pubkeyBeforeStop, date });
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(storage.store).not.toHaveBeenCalledWith({ pubkey: pubkeyAfterStop, date });
            });
        });

        describe('when the stream has never been started', () => {
            it('does nothing', () => {
                const { recorder } = createRecorder();
                recorder.stop();

                expect(recorder.status).toEqual(RECORDER_STATUS.NeverStarted);
            });
        });
    });
});
