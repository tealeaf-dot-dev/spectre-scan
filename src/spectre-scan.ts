import { PubkeyScanner } from './core/scanners/pubkey/PubkeyScanner.js';
import { NostrToolsPubkeySource } from './infra/sources/nostr-tools/adapters/NostrToolsPubkeySource.js';
import { SQLitePubkeyStorage } from './infra/storage/sqlite/adapters/SQLitePubkeyStorage.js';
import { pubkeyScannerConfig, sqliteConfig, nostrToolsSourceConfig } from './config.js';
import { stringifyError } from './shared/functions/stringifyError.js';

const source = new NostrToolsPubkeySource(nostrToolsSourceConfig);
const storage = new SQLitePubkeyStorage(sqliteConfig);
const spectreScan = new PubkeyScanner(source, storage);

try {
    await storage.init();
    spectreScan.scan(pubkeyScannerConfig);
} catch(error: unknown) {
    console.error(stringifyError(error));
}
