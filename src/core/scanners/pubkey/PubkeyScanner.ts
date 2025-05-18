import { IPubkeySourcePort } from "./ports/nostr/IPubkeySourcePort.js";
import { IPubkeyStoragePort } from "./ports/storage/IPubkeyStoragePort.js";
import { Pubkey } from "../../../shared/types.js";
import { IPubkeyScannerUserPort } from "./ports/user/IPubkeyScannerUserPort.js";
import { IPubkeyScannerConfig } from "./ports/user/dto/IPubkeyScannerConfig.js";
import { stringifyError } from "../../../shared/functions/stringifyError.js";

export class PubkeyScanner implements IPubkeyScannerUserPort {
    #relayScanner: IPubkeySourcePort;
    #storage: IPubkeyStoragePort;
    #initialized: boolean = false;

    constructor(relayScanner: IPubkeySourcePort, storage: IPubkeyStoragePort) {
        this.#relayScanner = relayScanner;
        this.#storage = storage;
    }

    get storage(): IPubkeyStoragePort {

        return this.#storage;
    }

    get relayScanner(): IPubkeySourcePort {

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

    run({ filters }: IPubkeyScannerConfig): void {

        if (this.#initialized) {
            this.#relayScanner
                .scan(filters)
                .subscribe({
                    next: (pubkey: Pubkey) => { this.#maybeStorePubkey(pubkey); },
                    error: (e: unknown) => { PubkeyScanner.#logSubscriptionError(e); },
                });
        } else {
            console.error('PubkeyScanner is not initialized');
        }
    }
}
