import { SQLiteStorage } from './storage/sqlite/SQLiteStorage.js';
import { NostrToolsRelayScanner } from './nostr/nostr-tools/NostrToolsRelayScanner.js';
import { PubkeyScanner } from './core/scanners/pubkey/PubkeyScanner.js';
import { scannerConfig, sqliteConfig } from './config.js';

const spectreScan = new PubkeyScanner(new NostrToolsRelayScanner(), new SQLiteStorage(sqliteConfig.databasePath));

await spectreScan.init();
spectreScan.run(scannerConfig);
