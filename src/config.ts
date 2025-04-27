import { IScannerConfig } from "./core/scanner/ports/input/IScannerConfig.js";

export const scannerConfig: IScannerConfig = {
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
