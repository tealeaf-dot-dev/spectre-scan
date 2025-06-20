import { IPubkeyEventData } from "./IPubkeyEventData.js";

export interface IPubkeyStoredEventData extends IPubkeyEventData {
    storageName: string,
}
