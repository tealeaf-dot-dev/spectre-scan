import { IPubkeyScannerConfig } from "./core/scanners/pubkey/ports/input/dto/IPubkeyScannerConfig.js";

interface ISQLiteConfig {
    databasePath: string;
}

export const scannerConfig: IPubkeyScannerConfig = {
    relayURLs: [
        'wss://relay.damus.io',
        'wss://nostr-pub.wellorder.net',
        'wss://nos.lol',
        'wss://relay.snort.social',
        'wss://relay.nostr.bg',
        'wss://offchain.pub',
        'wss://relay.nostr.band/all',
    ],
    filters: [
        { kinds: [1] },
    ]
};

export const sqliteConfig: ISQLiteConfig = {
    databasePath: './data/nostr_data.db',
};
