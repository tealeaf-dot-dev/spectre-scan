import { IPubkeyScannerConfig } from "./dto/IPubkeyScannerConfig.js";

export interface IPubkeyScannerInputPort {
    run(config: IPubkeyScannerConfig): void,
}
