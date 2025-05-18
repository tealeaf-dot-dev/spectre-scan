import { SQLiteStorage } from './infra/storage/sqlite/SQLiteStorage.js';
import { PubkeyScanner } from './core/scanners/pubkey/PubkeyScanner.js';
import { pubkeyScannerConfig, sqliteConfig, relayURLs } from './config.js';
import { NostrToolsPubkeyScanner } from './infra/nostr/nostr-tools/adapters/NostrToolsPubkeyScanner.js';

const pubkeyScanner = new NostrToolsPubkeyScanner({ relayURLs });
const storage = new SQLiteStorage(sqliteConfig.databasePath);
const spectreScan = new PubkeyScanner(pubkeyScanner, storage);

await spectreScan.init();
spectreScan.run(pubkeyScannerConfig);
