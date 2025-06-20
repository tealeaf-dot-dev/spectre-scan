export interface IFunctor<A> {
    map<B>(fn: (a: A) => B): IFunctor<B>,
}
