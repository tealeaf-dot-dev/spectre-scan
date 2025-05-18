import { SQLiteStorage } from './infra/storage/sqlite/SQLiteStorage.js';
import { NostrToolsRelayScanner } from './infra/nostr/nostr-tools/NostrToolsRelayScanner.js';
import { PubkeyScanner } from './core/scanners/pubkey/PubkeyScanner.js';
import { scannerConfig, sqliteConfig, relayURLs } from './config.js';

const relayScanner = new NostrToolsRelayScanner({ relayURLs });
const storage = new SQLiteStorage(sqliteConfig.databasePath);
const spectreScan = new PubkeyScanner(relayScanner, storage);

await spectreScan.init();
spectreScan.run(scannerConfig);
