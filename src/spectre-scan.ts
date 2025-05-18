import { SQLiteStorage } from './infra/storage/sqlite/SQLiteStorage.js';
import { PubkeyScanner } from './core/scanners/pubkey/PubkeyScanner.js';
import { pubkeyScannerConfig, sqliteConfig, nostrToolsSourceConfig } from './config.js';
import { NostrToolsPubkeySource } from './infra/sources/nostr-tools/adapters/NostrToolsPubkeySource.js';

const pubkeyScanner = new NostrToolsPubkeySource(nostrToolsSourceConfig);
const storage = new SQLiteStorage(sqliteConfig.databasePath);
const spectreScan = new PubkeyScanner(pubkeyScanner, storage);

await spectreScan.init();
spectreScan.run(pubkeyScannerConfig);
