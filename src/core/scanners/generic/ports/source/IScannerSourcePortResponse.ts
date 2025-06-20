import { Observable } from "rxjs";
import { IDomainEventData } from "../../../../eventing/data/IDomainEventData.js";
import { AbstractDomainActionEvent } from "../../../../eventing/events/AbstractDomainActionEvent.js";
import { AbstractDomainErrorEvent } from "../../../../eventing/events/AbstractDomainErrorEvent.js";
import { Either } from "../../../../../shared/fp/monads/Either.js";

export interface IScannerSourcePortResponse<
    ErrorEvent extends AbstractDomainErrorEvent,
    SuccessEvent extends AbstractDomainActionEvent<IDomainEventData>
> extends Observable<Either<ErrorEvent, SuccessEvent>> {}

export type ScannerSourcePortResponse = IScannerSourcePortResponse<
    AbstractDomainErrorEvent,
    AbstractDomainActionEvent<IDomainEventData>
>;

