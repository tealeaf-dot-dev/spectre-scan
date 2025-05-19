import { SQLiteStorage } from './infra/storage/sqlite/SQLiteStorage.js';
import { PubkeyScanner } from './core/scanners/pubkey/PubkeyScanner.js';
import { NostrToolsPubkeySource } from './infra/sources/nostr-tools/adapters/NostrToolsPubkeySource.js';
import { pubkeyScannerConfig, sqliteConfig, nostrToolsSourceConfig } from './config.js';

const source = new NostrToolsPubkeySource(nostrToolsSourceConfig);
const storage = new SQLiteStorage(sqliteConfig);
const spectreScan = new PubkeyScanner(source, storage);

await spectreScan.init();
spectreScan.scan(pubkeyScannerConfig);
