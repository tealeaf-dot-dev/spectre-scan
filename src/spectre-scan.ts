import { SQLiteStorage } from './storage/sqlite/SQLiteStorage.js';
import { NostrToolsRelayScanner } from './nostr/nostr-tools/NostrToolsRelayScanner.js';
import { PubkeyScanner } from './core/pubkey-scanner/PubkeyScanner.js';
import { scannerConfig } from './config.js';

const spectreScan = new PubkeyScanner(new NostrToolsRelayScanner(), new SQLiteStorage());

await spectreScan.run(scannerConfig);
