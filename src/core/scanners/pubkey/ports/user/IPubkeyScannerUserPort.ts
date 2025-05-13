import { IPubkeyScannerConfig } from "./dto/IPubkeyScannerConfig.js";

export interface IPubkeyScannerUserPort {
    run(config: IPubkeyScannerConfig): void,
}
