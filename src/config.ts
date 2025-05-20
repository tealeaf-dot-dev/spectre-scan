import { IPubkeyUserPortDTO } from "./core/scanners/pubkey/ports/user/dto/IPubkeyUserPortDTO.js";
import { INostrToolsSourceConfig } from "./infra/sources/nostr-tools/interfaces/INostrToolsSourceConfig.js";
import { ISQLiteConfig } from "./infra/storage/sqlite/interfaces/ISQLiteConfig.js";
import { RelayURLList } from "./shared/types.js";

export const relayURLs: RelayURLList = [
    'wss://relay.damus.io',
    'wss://nostr-pub.wellorder.net',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.nostr.bg',
    'wss://offchain.pub',
    'wss://relay.nostr.band/all',
];

export const pubkeyScannerConfig: IPubkeyUserPortDTO = {
    filters: [
        { kinds: [1] },
    ],
};

export const nostrToolsSourceConfig: INostrToolsSourceConfig = {
    relayURLs,
};

export const sqliteConfig: ISQLiteConfig = {
    databasePath: './data/nostr_data.db',
};
