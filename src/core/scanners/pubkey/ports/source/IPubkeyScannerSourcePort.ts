import { IScannerSourcePort } from "../../../generic/ports/source/IScannerSourcePort.js";
import { IPubkeyScannerSourcePortRequest } from "./IPubkeyScannerSourcePortRequest.js";
import { IPubkeyScannerSourcePortResponse } from "./IPubkeyScannerSourcePortResponse.js";

export interface IPubkeyScannerSourcePort extends IScannerSourcePort<IPubkeyScannerSourcePortRequest, IPubkeyScannerSourcePortResponse> {};
