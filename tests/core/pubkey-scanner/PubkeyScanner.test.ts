import { describe, it, expect } from "vitest";
import { mock } from "vitest-mock-extended";
import { PubkeyScanner } from "../../../src/core/pubkey-scanner/PubkeyScanner.js";
import { IRelayScannerPort } from "../../../src/core/pubkey-scanner/ports/nostr/IRelayScannerPort.js";
import { IPubkeyStoragePort } from "../../../src/core/pubkey-scanner/ports/storage/IPubkeyStoragePort.js";

describe('PubkeyScanner', () => {
    describe('Constructor', () => {
        it('Initializes storage and relayScanner properties', () => {
            const relayScanner = mock<IRelayScannerPort>();
            const storage = mock<IPubkeyStoragePort>();
            const scanner = new PubkeyScanner(relayScanner, storage);

            expect(scanner.relayScanner).toEqual(relayScanner);
            expect(scanner.storage).toEqual(storage);
        })
    })
})
