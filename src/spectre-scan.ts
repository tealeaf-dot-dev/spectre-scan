import { SQLiteStorage } from './storage/sqlite/SQLiteStorage.js';
import { NostrToolsRelayScanner } from './nostr/nostr-tools/NostrToolsRelayScanner.js';
import { PubkeyScanner } from './core/pubkey-scanner/PubkeyScanner.js';
import { scannerConfig, sqliteConfig } from './config.js';

const spectreScan = new PubkeyScanner(new NostrToolsRelayScanner(), new SQLiteStorage(sqliteConfig.databasePath));

await spectreScan.run(scannerConfig);
