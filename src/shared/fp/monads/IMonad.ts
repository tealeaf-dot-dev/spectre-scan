import { IApplicative } from "../applicatives/IApplicative.js";

export interface IMonad<A> extends IApplicative<A> {
    join<B>(): IMonad<A|B>,
    chain<B>(fn: (a: A) => IMonad<B>): IMonad<B>,
}
