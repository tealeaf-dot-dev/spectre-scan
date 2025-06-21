import { RelayURLList } from "./infra/sources/shared/types.js";
import { FiltersList } from "./shared/types.js";

export const relayURLs: RelayURLList = [
    'wss://relay.damus.io',
    'wss://nostr-pub.wellorder.net',
    'wss://nos.lol',
    'wss://relay.snort.social',
    'wss://relay.nostr.bg',
    'wss://offchain.pub',
    'wss://relay.nostr.band/all',
];

export const pubkeyFilters: FiltersList = [
    { kinds: [1] },
];

export const databasePath = './data/nostr_data.db';
