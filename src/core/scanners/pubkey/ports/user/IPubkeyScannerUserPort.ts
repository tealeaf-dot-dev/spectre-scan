import { IPubkeyUserPortDTO } from "./dto/IPubkeyUserPortDTO.js";

export interface IPubkeyScannerUserPort {
    scan(config: IPubkeyUserPortDTO): void,
}
