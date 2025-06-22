import { FiltersList } from "../../data/types.js";
import { IAbstractStreamProcessor } from "../../stream-processor/IAbstractSteamProcessor.js";
import { IScannerSourcePort } from "./ports/source/IScannerSourcePort.js";
import { IScannerSourcePortRequest } from "./ports/source/IScannerSourcePortRequest.js";
import { ScannerSourcePortResponse } from "./ports/source/IScannerSourcePortResponse.js";

export interface IScanner<
    SourcePort extends IScannerSourcePort<IScannerSourcePortRequest, ScannerSourcePortResponse>
> extends IAbstractStreamProcessor {
    get sources(): SourcePort[];
    get filters(): FiltersList;
}
