import { Observable } from "rxjs";
import { FiltersList } from "../../../../shared/types.js";

export interface ISourcePort<T> {
    scan(filters: FiltersList): Observable<T>;
    stop(): void;
}
