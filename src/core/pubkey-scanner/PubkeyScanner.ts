import { IRelayScannerPort } from "./ports/nostr/IRelayScannerPort.js";
import { IPubkeyStoragePort } from "./ports/storage/IPubkeyStoragePort.js";
import { Pubkey } from "../../shared/types.js";
import { IPubkeyScannerInputPort } from "./ports/input/IPubkeyScannerInputPort.js";
import { IPubkeyScannerConfig } from "./ports/input/dto/IPubkeyScannerConfig.js";
import { stringifyError } from "../../shared/functions/stringifyError.js";

export class PubkeyScanner implements IPubkeyScannerInputPort {
    #relayScanner: IRelayScannerPort;
    #storage: IPubkeyStoragePort;

    #maybeStorePubkey(pubkey: Pubkey): void {
        this.#storage.storePubkey(pubkey, new Date()).catch((error: unknown) => {
            console.error(`Error storing pubkey ${pubkey}: ${stringifyError(error)}`);
        });
    }

    static #logSubscriptionError(error: unknown): void {
        console.error(`Subscription error: ${stringifyError(error)}`);
    }

    constructor(relayScanner: IRelayScannerPort, storage: IPubkeyStoragePort) {
        this.#relayScanner = relayScanner;
        this.#storage = storage;
    }

    async run(config: IPubkeyScannerConfig): Promise<void> {
        const { relayURLs, filters } = config;

        try {
            await this.#storage.init();

            this.#relayScanner
                .scan(relayURLs, filters)
                .subscribe({
                    next: (pubkey: Pubkey) => { this.#maybeStorePubkey(pubkey); },
                    error: (e: unknown) => { PubkeyScanner.#logSubscriptionError(e) },
                });
        } catch (error: unknown) {
            console.error(`Failed to initialize: ${stringifyError(error)}`);
        }
    }
}
