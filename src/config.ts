import { IPubkeyScannerConfig } from "./core/scanners/pubkey/ports/user/dto/IPubkeyScannerConfig.js";
import { RelayURLList } from "./shared/types.js";

interface ISQLiteConfig {
    databasePath: string;
}

export const pubkeyScannerConfig: IPubkeyScannerConfig = {
    filters: [
        { kinds: [1] },
    ],
};

export const relayURLs: RelayURLList = [
    'wss://relay.damus.io',
    'wss://nostr-pub.wellorder.net',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.nostr.bg',
    'wss://offchain.pub',
    'wss://relay.nostr.band/all',
];

export const sqliteConfig: ISQLiteConfig = {
    databasePath: './data/nostr_data.db',
};
