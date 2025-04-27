import { Scanner } from './core/scanner/Scanner.js';
import { IScannerConfig } from './core/scanner/ports/input/IScannerConfig.js';
import { SQLiteStorage } from './storage/sqlite/SQLiteStorage.js';
import { NostrToolsRelayScanner } from './nostr/nostr-tools/NostrToolsRelayScanner.js';

const config: IScannerConfig = {
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

const spectreScan = new Scanner(new NostrToolsRelayScanner(), new SQLiteStorage());

await spectreScan.run(config);
