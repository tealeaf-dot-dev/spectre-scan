import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { from, Observable } from 'rxjs';
import { PubkeyScanner } from '../../../../src/core/scanners/pubkey/PubkeyScanner.js';
import { IPubkeySourcePort } from '../../../../src/core/scanners/pubkey/ports/source/IPubkeySourcePort.js';
import { IPubkeyStoragePort } from '../../../../src/core/scanners/pubkey/ports/storage/IPubkeyStoragePort.js';
import { pubkeyScannerConfig } from '../../../../src/config.js';
import { Pubkey } from '../../../../src/shared/types.js';

const TEST_PUBKEYS: Pubkey[] = ['pubkey1', 'pubkey2', 'pubkey3'];

function createPubkeyScanner() {
    const relayScanner = mock<IPubkeySourcePort>();
    const storage = mock<IPubkeyStoragePort>();
    const pubkeyScanner = new PubkeyScanner(relayScanner, storage);

    return { pubkeyScanner, relayScanner, storage };
}

describe('PubkeyScanner', () => {
    afterEach(() => vi.clearAllMocks());

    describe('constructor(relayScanner, storage)', () => {
        it('initializes dependencies', () => {
            const { pubkeyScanner, relayScanner, storage } = createPubkeyScanner();

            expect(pubkeyScanner.relayScanner).toBe(relayScanner);
            expect(pubkeyScanner.storage).toBe(storage);
        });
    });

    describe('init()', () => {
        it('initializes storage', async () => {
            const { pubkeyScanner, storage } = createPubkeyScanner();

            await pubkeyScanner.init();

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(storage.init).toHaveBeenCalledOnce();
            expect(pubkeyScanner.initialized).toBe(true);
        });

        describe('when storage initialization fails', () => {
            let pubkeyScanner: PubkeyScanner;
            let storage: ReturnType<typeof mock<IPubkeyStoragePort>>;
            let errorSpy: ReturnType<typeof vi.spyOn>;

            beforeEach(async () => {
                ({ pubkeyScanner, storage } = createPubkeyScanner());

                errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
                storage.init.mockRejectedValue(new Error('init fail'));

                await pubkeyScanner.init();
            });

            afterEach(() => {
                errorSpy.mockRestore();
            });

            it('sets initialized to false', () => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(storage.init).toHaveBeenCalledOnce();
                expect(pubkeyScanner.initialized).toBe(false);
            });

            it('logs an error to the console', () => {
                expect(errorSpy).toHaveBeenCalledOnce();
            });
        });
    });

    describe('scan()', () => {
        describe('when initialized', () => {
            let relayScanner: ReturnType<typeof mock<IPubkeySourcePort>>;
            let storage: ReturnType<typeof mock<IPubkeyStoragePort>>;
            let pubkeyScanner: PubkeyScanner;

            beforeEach(async () => {
                ({ pubkeyScanner, relayScanner, storage } = createPubkeyScanner());

                const pubkey$: Observable<Pubkey> = from(TEST_PUBKEYS);
                relayScanner.start.mockReturnValue(pubkey$);
                storage.storePubkey.mockResolvedValue();

                await pubkeyScanner.init();
                pubkeyScanner.scan(pubkeyScannerConfig);
                await new Promise(r => setTimeout(r, 0));
            });

            it('scans relays for pubkeys', () => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(relayScanner.start).toHaveBeenCalledOnce();
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(relayScanner.start).toHaveBeenCalledWith(
                    pubkeyScannerConfig.filters,
                );
            });

            it('stores discovered pubkeys', () => {
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(storage.storePubkey).toHaveBeenCalledTimes(TEST_PUBKEYS.length);
                for (const pk of TEST_PUBKEYS) {
                    // eslint-disable-next-line @typescript-eslint/unbound-method
                    expect(storage.storePubkey).toHaveBeenCalledWith(pk, expect.any(Date));
                }
            });
        });

        describe('when uninitialized', () => {
            it('logs an error to the console', () => {
                const { pubkeyScanner, relayScanner, storage } = createPubkeyScanner();
                const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

                pubkeyScanner.scan(pubkeyScannerConfig);

                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(relayScanner.start).not.toHaveBeenCalled();
                // eslint-disable-next-line @typescript-eslint/unbound-method
                expect(storage.storePubkey).not.toHaveBeenCalled();
                expect(errorSpy).toHaveBeenCalledOnce();
            });
        });
    });
});

