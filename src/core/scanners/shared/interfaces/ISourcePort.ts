import { Observable } from "rxjs";
import { FiltersList } from "../../../../shared/types.js";

export interface ISourcePort<T> {
    start(filters: FiltersList): Observable<T>;
    stop(): void;
}
