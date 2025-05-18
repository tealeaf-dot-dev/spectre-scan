import { Observable } from "rxjs";
import { FiltersList, Pubkey } from "../../../../../shared/types.js";

export interface IRelayScannerPort<T> {
    scan(filters: FiltersList): Observable<T>;
    stop(): void;
}

export type IPubkeyScannerPort = IRelayScannerPort<Pubkey>;
