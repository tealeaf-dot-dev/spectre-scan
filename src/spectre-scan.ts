import { PubkeyScanner } from './core/scanners/pubkey/PubkeyScanner.js';
import { NostrToolsPubkeySource } from './infra/sources/nostr-tools/adapters/NostrToolsPubkeySource.js';
import { SQLitePubkeyStorage } from './infra/storage/sqlite/adapters/SQLitePubkeyStorage.js';
import { nostrToolsPubkeySourceConfig, sqlitePubkeyStorageConfig, pubkeyScannerConfig } from './config.js';
import { InMemoryEventBus } from './infra/event-buses/InMemoryEventBus.js';
import { PubkeyRecorder } from './core/recorders/pubkey/PubkeyRecorder.js';
import { tap, filter } from 'rxjs';
import { isDomainNotificationEvent } from './core/eventing/type-guards/isDomainNotificationEvent.js';
import { AbstractDomainNotificationEvent } from './core/eventing/events/AbstractDomainNotificationEvent.js';
import { isDomainErrorEvent } from './core/eventing/type-guards/isDomainErrorEvent.js';
import { AbstractDomainErrorEvent } from './core/eventing/events/AbstractDomainErrorEvent.js';
import { stringifyError } from './shared/utils/stringifyError.js';

const eventBus = InMemoryEventBus.create();
const source = new NostrToolsPubkeySource({ eventBus, ...nostrToolsPubkeySourceConfig });
const scanner = new PubkeyScanner(eventBus, [source], pubkeyScannerConfig.filters);
const storage = new SQLitePubkeyStorage({ eventBus, ...sqlitePubkeyStorageConfig });
const recorder = new PubkeyRecorder(eventBus, [storage]);

try {
    await storage.init();
    recorder.start();
    scanner.start();

    eventBus.events$.pipe(
        filter(isDomainNotificationEvent),
        tap((evt: AbstractDomainNotificationEvent) => { console.log(evt.notification); }),
    ).subscribe();

    eventBus.events$.pipe(
        filter(isDomainErrorEvent),
        tap((evt: AbstractDomainErrorEvent) => { console.error(evt.error); }),
    ).subscribe();
} catch(error: unknown) {
    console.error(stringifyError(error));
}
