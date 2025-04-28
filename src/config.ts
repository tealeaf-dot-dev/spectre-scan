import { IPubkeyScannerConfig } from "./core/pubkey-scanner/ports/input/IPubkeyScannerConfig.js";

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
}
