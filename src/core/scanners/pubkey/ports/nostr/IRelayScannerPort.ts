import { Observable } from "rxjs";
import { FiltersList, Pubkey } from "../../../../../shared/types.js";

export interface IRelayScannerPort {
    scan(filters: FiltersList): Observable<Pubkey> 
}
