import { IScannerInputPort } from "./ports/input/IScannerInputPort.js";
import { IRelayScannerPort } from "./ports/nostr/IRelayScannerPort.js";
import { IPubkeyStoragePort } from "./ports/storage/IPubkeyStoragePort.js";
import { IScannerConfig } from "./ports/input/IScannerConfig.js";
import { Pubkey } from "../../shared/types.js";

export class Scanner implements IScannerInputPort {
    #relayScanner: IRelayScannerPort;
    #storage: IPubkeyStoragePort;

    #maybeStorePubkey(pubkey: Pubkey): void {
        try {
            this.#storage.storePubkey(pubkey, new Date());
        } catch (error: unknown) {
            console.error(`Error storing pubkey ${pubkey}: ${
                error instanceof Error ? error.message : String(error)
            }`);
        }
    }

    static #logSubscriptionError(error: unknown): void {
        console.error(`Subscription error: ${
            error instanceof Error ? error.message : String(error)
        }`);
    }

    constructor(relayScanner: IRelayScannerPort, storage: IPubkeyStoragePort) {
        this.#relayScanner = relayScanner;
        this.#storage = storage;
    }

    async run(config: IScannerConfig): Promise<void> {
        const { relayURLs, filters } = config;

        try {
            await this.#storage.init();

            this.#relayScanner
                .scan(relayURLs, filters)
                .subscribe({
                    next: (pubkey: Pubkey) => { this.#maybeStorePubkey(pubkey); },
                    error: (e: unknown) => { Scanner.#logSubscriptionError(e) },
                });
        } catch (error: unknown) {
            console.error(`Failed to initialize: ${
                error instanceof Error ? error.message : String(error)
            }`);
        }
    }
}
