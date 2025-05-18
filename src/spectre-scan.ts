import { SQLiteStorage } from './infra/storage/sqlite/SQLiteStorage.js';
import { PubkeyScanner } from './core/scanners/pubkey/PubkeyScanner.js';
import { pubkeyScannerConfig, sqliteConfig, relayURLs } from './config.js';
import { NostrToolsPubkeySource } from './infra/sources/nostr-tools/adapters/NostrToolsPubkeySource.js';

const pubkeyScanner = new NostrToolsPubkeySource({ relayURLs });
const storage = new SQLiteStorage(sqliteConfig.databasePath);
const spectreScan = new PubkeyScanner(pubkeyScanner, storage);

await spectreScan.init();
spectreScan.run(pubkeyScannerConfig);
