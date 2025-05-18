import { RelayURLList } from "../../../../shared/types.js";

export interface INostrToolsRelayScannerConfig {
    relayURLs: RelayURLList,
    retryDelay?: number,
}
