import { IFunctor } from "../functors/IFunctor.js";

export interface IApplicative<A> extends IFunctor<A> {
    of(a: A): IApplicative<A>,
    ap<B, C>(app: IApplicative<B>): IApplicative<C>,
}
