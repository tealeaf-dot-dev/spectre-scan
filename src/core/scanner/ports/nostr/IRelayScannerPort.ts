import { Observable } from "rxjs";
import { FiltersList, Pubkey, RelayURLList } from "../../../../shared/types.js";

export interface IRelayScannerPort {
    scan(relayURLs: RelayURLList, filters: FiltersList): Observable<Pubkey> 
}
