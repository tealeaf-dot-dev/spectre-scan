import { IScannerSourcePort } from "./ports/source/IScannerSourcePort.js";
import { IScannerSourcePortRequest } from "./ports/source/IScannerSourcePortRequest.js";
import { ScannerSourcePortResponse } from "./ports/source/IScannerSourcePortResponse.js";
import { IScannerUserPorts } from "./ports/user/IScannerUserPorts.js";

export interface IScanner<
    SourcePort extends IScannerSourcePort<IScannerSourcePortRequest, ScannerSourcePortResponse>
> extends IScannerUserPorts {
    get sources(): SourcePort[];
}
