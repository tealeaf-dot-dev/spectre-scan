import { RelayURLList } from "../../../../shared/types.js";

export interface INostrToolsSourceConfig {
    relayURLs: RelayURLList,
    retryDelay?: number,
}
