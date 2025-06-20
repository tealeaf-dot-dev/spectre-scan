import { ScannerSourcePortResponse } from "./IScannerSourcePortResponse.js";
import { IScannerSourcePortRequest } from "./IScannerSourcePortRequest.js";

export interface IScannerSourcePort<
    ScannerRequest extends IScannerSourcePortRequest,
    ScannerResponse extends ScannerSourcePortResponse
> {
    start(request: ScannerRequest): ScannerResponse;
    stop(): void;
}
