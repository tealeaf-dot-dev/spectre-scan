import { describe, it, expect, vi } from "vitest";
import { mock } from "vitest-mock-extended";
import { from, Observable } from 'rxjs';
import { PubkeyScanner } from "../../../src/core/pubkey-scanner/PubkeyScanner.js";
import { IRelayScannerPort } from "../../../src/core/pubkey-scanner/ports/nostr/IRelayScannerPort.js";
import { IPubkeyStoragePort } from "../../../src/core/pubkey-scanner/ports/storage/IPubkeyStoragePort.js";
import { scannerConfig } from '../../../src/config.js';
import { Pubkey } from "../../../src/shared/types.js";

describe('PubkeyScanner', () => {
    function createPubkeyScanner() {
        const relayScanner = mock<IRelayScannerPort>();
        const storage = mock<IPubkeyStoragePort>();
        const pubkeyScanner = new PubkeyScanner(relayScanner, storage);

        return { pubkeyScanner, storage, relayScanner };
    }

    const testPubkeys: Pubkey[] = ['pubkey1', 'pubkey2', 'pubkey3'];

    describe('Constructor', () => {
        it('Initializes properties', () => {
            const { pubkeyScanner, relayScanner, storage } = createPubkeyScanner();

            expect(pubkeyScanner.relayScanner).toEqual(relayScanner);
            expect(pubkeyScanner.storage).toEqual(storage);
        });
    });

    describe('init()', () => {
        it('Initializes storage', async () => {
            const { pubkeyScanner, storage } = createPubkeyScanner();

            await pubkeyScanner.init();

            expect(storage.init).toHaveBeenCalledOnce();
            expect(pubkeyScanner.initialized).toEqual(true);
        });

        it('Remains uninitialized if storage initialization fails', async () => {
            const { pubkeyScanner, storage } = createPubkeyScanner();
            const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

            storage.init.mockRejectedValue(new Error('Storage failed to initialize'));

            await pubkeyScanner.init();

            expect(storage.init).toHaveBeenCalledOnce();
            expect(pubkeyScanner.initialized).toEqual(false);
            expect(errorLog).toHaveBeenCalled();
        });
    });

    describe('run()', () => {
        describe('When initialized', async () => {
            const { pubkeyScanner, relayScanner, storage } = createPubkeyScanner();
            const pubkey$: Observable<Pubkey> = from(testPubkeys);

            relayScanner.scan.mockReturnValue(pubkey$);
            storage.storePubkey.mockResolvedValue();

            await pubkeyScanner.init();
            pubkeyScanner.run(scannerConfig);
            await new Promise(resolve => setTimeout(resolve, 0)); // Wait for the current event loop cycle to finish, allowing the observable stream to complete

            it('Scans relays for pubkeys', async () => {
                expect(relayScanner.scan).toHaveBeenCalledOnce();
                expect(relayScanner.scan).toHaveBeenCalledWith(scannerConfig.relayURLs, scannerConfig.filters);
            });

            it('Stores pubkeys', async () => {
                expect(storage.storePubkey).toHaveBeenCalledTimes(testPubkeys.length);
                expect(storage.storePubkey).toHaveBeenCalledWith('pubkey1', expect.any(Date));
                expect(storage.storePubkey).toHaveBeenCalledWith('pubkey2', expect.any(Date));
                expect(storage.storePubkey).toHaveBeenCalledWith('pubkey3', expect.any(Date));
            });
        });

        describe('When uninitialized', () => {
            it('Does nothing', async () => {
                const { pubkeyScanner, relayScanner, storage } = createPubkeyScanner();
                const pubkey$: Observable<Pubkey> = from(testPubkeys);

                relayScanner.scan.mockReturnValue(pubkey$);
                storage.storePubkey.mockResolvedValue();

                pubkeyScanner.run(scannerConfig);

                expect(relayScanner.scan).not.toHaveBeenCalled();
                expect(storage.storePubkey).not.toHaveBeenCalled();
            });
        });
    });
});
