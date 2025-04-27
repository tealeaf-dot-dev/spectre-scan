import { Scanner } from './core/scanner/Scanner.js';
import { SQLiteStorage } from './storage/sqlite/SQLiteStorage.js';
import { NostrToolsRelayScanner } from './nostr/nostr-tools/NostrToolsRelayScanner.js';
import { scannerConfig } from './config.js';

const spectreScan = new Scanner(new NostrToolsRelayScanner(), new SQLiteStorage());

await spectreScan.run(scannerConfig);
