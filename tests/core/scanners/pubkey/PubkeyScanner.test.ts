import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { from } from 'rxjs';
import { PubkeyScanner } from '../../../../src/core/scanners/pubkey/PubkeyScanner.js';
import { IEventBusPort } from '../../../../src/core/eventing/ports/event-bus/IEventBusPort.js';
import { PubkeyFoundEvent } from '../../../../src/core/recorders/pubkey/eventing/events/PubkeyFoundEvent.js';
import { PubkeySourceErrorEvent } from '../../../../src/core/scanners/pubkey/eventing/events/PubkeySourceErrorEvent.js';
import { IPubkeyScannerSourcePort } from '../../../../src/core/scanners/pubkey/ports/source/IPubkeyScannerSourcePort.js';
import { pubkeyScannerConfig } from '../../../../src/config.js';
import { Either, left, map, right } from 'fp-ts/lib/Either.js';
import dayjs from 'dayjs';

const DATE = dayjs();
const ERROR_EVENT_INDEX = 1;
const pubkeyFilters = pubkeyScannerConfig.filters;

const EVENTS: Either<PubkeySourceErrorEvent, PubkeyFoundEvent>[] = ['pubkey1', 'pubkey2', 'pubkey3']
    .map((pubkey, index) => {
        const evt = index === ERROR_EVENT_INDEX ? new PubkeySourceErrorEvent('PubkeySource', { source: 'PubkeySource', message: 'source error'}) : new PubkeyFoundEvent('PubkeySource', { pubkey, date: DATE });

        return evt;
    })
    .map((evt, index) => index === ERROR_EVENT_INDEX ? left(evt as PubkeySourceErrorEvent) : right(evt as PubkeyFoundEvent));

function createPubkeyScanner() {
    const source = mock<IPubkeyScannerSourcePort>();
    const eventBus = mock<IEventBusPort>();
    const pubkeyScanner = new PubkeyScanner(eventBus, [source], pubkeyFilters);

    return { pubkeyScanner, source, eventBus };
}

describe('PubkeyScanner', () => {
    afterEach(() => vi.clearAllMocks());

    describe('constructor()', () => {
        it('initializes properties', () => {
            const { pubkeyScanner, source, eventBus } = createPubkeyScanner();

            expect(pubkeyScanner.sources).toStrictEqual([source]);
            expect(pubkeyScanner.eventBus).toStrictEqual(eventBus);
            expect(pubkeyScanner.filters).toStrictEqual(pubkeyFilters);
        });
    });

    describe('start()', () => {
        let source: ReturnType<typeof mock<IPubkeyScannerSourcePort>>;
        let eventBus: ReturnType<typeof mock<IEventBusPort>>;
        let pubkeyScanner: PubkeyScanner;

        beforeEach(async () => {
            ({ pubkeyScanner, source, eventBus } = createPubkeyScanner());

            const pubkey$ = from(EVENTS);

            source.start.mockReturnValue(pubkey$);
            pubkeyScanner.start();

            await new Promise(r => setTimeout(r, 0));
        });

        afterEach(() => {
            pubkeyScanner.stop();
        });

        it('scans for pubkeys', () => {
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(source.start).toHaveBeenCalledOnce();
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(source.start).toHaveBeenCalledWith(
                { filters: pubkeyFilters },
            );
        });

        it('publishes discovered pubkeys', () => {
            expect.assertions(2);

            const evt1 = eventBus.publish.mock.calls[0][0];

            expect(evt1).toBeInstanceOf(PubkeyFoundEvent);
            map<PubkeyFoundEvent, undefined>((evt) => { expect(evt1.data.pubkey).toEqual(evt.data.pubkey); })(EVENTS[0]);
        });

        it('publishes source errors', () => {
            expect.assertions(1);

            const evt2 = eventBus.publish.mock.calls[1][0];

            expect(evt2).toBeInstanceOf(PubkeySourceErrorEvent);
        });

        it('continues publishing pubkeys after receiving source errors', () => {
            expect.assertions(2);

            const evt3 = eventBus.publish.mock.calls[2][0];

            expect(evt3).toBeInstanceOf(PubkeyFoundEvent);
            map<PubkeyFoundEvent, undefined>((evt) => { expect(evt3.data.pubkey).toEqual(evt.data.pubkey); })(EVENTS[2]);
        });
    });
});
