import { IScannerConfig } from "./IScannerConfig.js";

export interface IScannerInputPort {
    run(config: IScannerConfig): Promise<void>,
}
