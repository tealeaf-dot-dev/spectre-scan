import { IPubkeySourcePort } from "./ports/source/IPubkeySourcePort.js";
import { IPubkeyStoragePort } from "./ports/storage/IPubkeyStoragePort.js";
import { Pubkey } from "../../../shared/types.js";
import { IPubkeyScannerUserPort } from "./ports/user/IPubkeyScannerUserPort.js";
import { IPubkeyScannerConfig } from "./ports/user/dto/IPubkeyScannerConfig.js";
import { stringifyError } from "../../../shared/functions/stringifyError.js";

export class PubkeyScanner implements IPubkeyScannerUserPort {
    #source: IPubkeySourcePort;
    #storage: IPubkeyStoragePort;

    constructor(source: IPubkeySourcePort, storage: IPubkeyStoragePort) {
        this.#source = source;
        this.#storage = storage;
    }

    get storage(): IPubkeyStoragePort {

        return this.#storage;
    }

    get source(): IPubkeySourcePort {

        return this.#source;
    }

    #maybeStorePubkey(pubkey: Pubkey): void {
        this.#storage.storePubkey(pubkey, new Date())
            .catch((error: unknown) => {
                console.error(`Error storing pubkey ${pubkey}: ${stringifyError(error)}`);
            });
    }

    static #logSourceError(error: unknown): void {
        console.error(`Source error: ${stringifyError(error)}`);
    }

    scan({ filters }: IPubkeyScannerConfig): void {
        this.#source
            .start(filters)
            .subscribe({
                next: (pubkey: Pubkey) => { this.#maybeStorePubkey(pubkey); },
                error: (e: unknown) => { PubkeyScanner.#logSourceError(e); },
            });
    }
}
