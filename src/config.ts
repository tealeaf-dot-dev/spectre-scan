import { FiltersList } from "./core/data/types.js";
import { RelayURLList } from "./infra/sources/data/types.js";

interface INostrToolsPubkeySourceConfig {
    relayURLs: RelayURLList,
}

interface IPubkeyScannerConfig {
    filters: FiltersList,
}

interface ISQLitePubkeyStorageConfig {
    databasePath: string,
}

export const nostrToolsPubkeySourceConfig: INostrToolsPubkeySourceConfig = {
    relayURLs: [
        'wss://relay.damus.io',
        'wss://nostr-pub.wellorder.net',
        'wss://nos.lol',
        'wss://relay.snort.social',
        'wss://relay.nostr.bg',
        'wss://offchain.pub',
        'wss://relay.nostr.band/all',
    ]
};

export const pubkeyScannerConfig: IPubkeyScannerConfig = {
    filters: [
        { kinds: [1] },
    ],
};

export const sqlitePubkeyStorageConfig: ISQLitePubkeyStorageConfig = {
    databasePath:  './data/nostr_data.db',
};
