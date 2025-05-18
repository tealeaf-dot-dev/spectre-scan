import { Observable } from "rxjs";
import { FiltersList, Pubkey } from "../../../../../shared/types.js";

export interface ISourcePort<T> {
    scan(filters: FiltersList): Observable<T>;
    stop(): void;
}

export type IPubkeyScannerPort = ISourcePort<Pubkey>;
