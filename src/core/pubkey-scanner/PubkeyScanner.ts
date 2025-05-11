import { IRelayScannerPort } from "./ports/nostr/IRelayScannerPort.js";
import { IPubkeyStoragePort } from "./ports/storage/IPubkeyStoragePort.js";
import { Pubkey } from "../../shared/types.js";
import { IPubkeyScannerInputPort } from "./ports/input/IPubkeyScannerInputPort.js";
import { IPubkeyScannerConfig } from "./ports/input/dto/IPubkeyScannerConfig.js";
import { stringifyError } from "../../shared/functions/stringifyError.js";

export class PubkeyScanner implements IPubkeyScannerInputPort {
    #relayScanner: IRelayScannerPort;
    #storage: IPubkeyStoragePort;
    #initialized: boolean = false;

    constructor(relayScanner: IRelayScannerPort, storage: IPubkeyStoragePort) {
        this.#relayScanner = relayScanner;
        this.#storage = storage;
    }

    get storage(): IPubkeyStoragePort {

        return this.#storage;
    }

    get relayScanner(): IRelayScannerPort {

        return this.#relayScanner;
    }

    get initialized(): boolean {

        return this.#initialized;
    }

    #maybeStorePubkey(pubkey: Pubkey): void {
        this.#storage.storePubkey(pubkey, new Date())
            .catch((error: unknown) => {
                console.error(`Error storing pubkey ${pubkey}: ${stringifyError(error)}`);
            });
    }

    static #logSubscriptionError(error: unknown): void {
        console.error(`Subscription error: ${stringifyError(error)}`);
    }

    async init(): Promise<void> {
        try {
            await this.#storage.init();
            this.#initialized = true;
        } catch (error: unknown) {
            console.error(`Failed to initialize: ${stringifyError(error)}`);
        }
    }

    run(config: IPubkeyScannerConfig): void {
        const { relayURLs, filters } = config;

        if (this.#initialized) {
            this.#relayScanner
                .scan(relayURLs, filters)
                .subscribe({
                    next: (pubkey: Pubkey) => { this.#maybeStorePubkey(pubkey); },
                    error: (e: unknown) => { PubkeyScanner.#logSubscriptionError(e); },
                });
        } else {
            console.error('PubkeyScanner is not initialized');
        }
    }
}
