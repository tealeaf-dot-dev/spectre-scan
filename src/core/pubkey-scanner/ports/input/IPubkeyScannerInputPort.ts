import { IPubkeyScannerConfig } from "./IPubkeyScannerConfig.js";

export interface IPubkeyScannerInputPort {
    run(config: IPubkeyScannerConfig): Promise<void>,
}
