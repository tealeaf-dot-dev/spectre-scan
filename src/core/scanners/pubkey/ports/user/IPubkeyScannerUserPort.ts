import { IPubkeyScannerConfig } from "./dto/IPubkeyScannerConfig.js";

export interface IPubkeyScannerUserPort {
    scan(config: IPubkeyScannerConfig): void,
}
