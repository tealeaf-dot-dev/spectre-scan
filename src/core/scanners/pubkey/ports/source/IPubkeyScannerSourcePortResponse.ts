import { PubkeyFoundEvent } from "../../../../recorders/pubkey/eventing/events/PubkeyFoundEvent.js";
import { IScannerSourcePortResponse } from "../../../generic/ports/source/IScannerSourcePortResponse.js";
import { PubkeySourceErrorEvent } from "../../eventing/events/PubkeySourceErrorEvent.js";

export interface IPubkeyScannerSourcePortResponse extends IScannerSourcePortResponse<PubkeySourceErrorEvent, PubkeyFoundEvent> {};
