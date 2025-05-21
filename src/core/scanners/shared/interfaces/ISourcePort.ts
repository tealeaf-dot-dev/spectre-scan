import { Observable } from "rxjs";
import { ISourcePortDTO } from "./ISourcePortDTO.js";

export interface ISourcePort<T> {
    start(dto: ISourcePortDTO): Observable<T>;
    stop(): void;
}
