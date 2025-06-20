import { describe, it, expect } from "vitest";
import { Left, Right, left, right } from '../../../../src/shared/fp/monads/Either.js';

const compose = <A, B, C>(g: (b: B) => C) => (f: (a: A) => B) => (a: A): C => g(f(a));

describe('Right', () => {
    it('passes the Functor identity law', () => {
        const r = Right.of(9);
        const s = r.map(i => i);

        expect(r.value).toEqual(s.value);
    });

    it('passes the Functor composition law', () => {
        const double = (i: number): number => 2 * i;
        const add3 = (i: number): number => 3 + i;
        const val = 9;

        const lhs = Right.of(val).map(compose<number, number, number>(double)(add3));
        const rhs = Right.of(val).map(add3).map(double);

        expect(lhs.value).toEqual(rhs.value);
    });

    it('passes the Applicative identity law', () => {
        const r = Right.of(9);
        const s = Right.of((i: number): number => i);
        const result = s.ap(r);

        expect(result.value).toEqual(r.value) ;
    });

    it('passes the Applicative homomorphism law', () => {
        const val = 9;
        const fn = (i: number): number => 2 * i;
        const lhs = Right.of(fn).ap(Right.of(val));
        const rhs = Right.of(fn(val));

        expect(lhs.value).toEqual(rhs.value);
    });

    it('passes the Applicative interchange law', () => {
        const val = 9;
        const fn = (i: number): number => 2 * i;
        const vfn = (fn: (i: number) => number): number => fn(val);
        const lhs = Right.of(fn).ap(Right.of(val));
        const rhs = Right.of(vfn).ap(Right.of(fn));

        expect(lhs.value).toEqual(rhs.value);
    });

    it('passes the Applicative composition law', () => {
        const double = (i: number): number => 2 * i;
        const add3 = (i: number): number => 3 + i;
        const val = 9;
        const lhs = Right.of(compose).ap(Right.of(double)).ap(Right.of(add3)).ap(Right.of(val));
        const rhs = Right.of(double).ap(Right.of(add3).ap(Right.of(val)));

        expect(lhs.value).toEqual(rhs.value);
    });

    it('passes the Monad left identity law', () => {
        const double = (i: number): Right<unknown, number> => Right.of(2 * i);
        const val = 9;
        const lhs = Right.of(val).chain(double);
        const rhs = double(val);

        expect(lhs.value).toEqual(rhs.value);
    });

    it('passes the Monad right identity law', () => {
        const val = 9;
        const lhs = Right.of(val).chain(v => Right.of(v));
        const rhs = Right.of(val);

        expect(lhs.value).toEqual(rhs.value);
    });

    it('passes the Monad associativity law', () => {
        const double = (i: number): Right<unknown, number> => Right.of(2 * i);
        const add3 = (i: number): Right<unknown, number> => Right.of(i + 3);
        const val = 9;
        const lhs = Right.of(val).chain(x => add3(x).chain(double));
        const rhs = Right.of(val).chain(add3).chain(double);

        expect(lhs.value).toEqual(rhs.value);
    });

    describe('of()', () => {
        it('creates a new Right value', () => {
            const a = 9;
            const b = 10;
            const r = Right.of(a);
            const s = r.of(b);

            expect(r.value).toEqual(a);
            expect(r.isLeft()).toBeFalsy();
            expect(r.isRight()).toBeTruthy();
            expect(s.value).toEqual(b);
            expect(s.isLeft()).toBeFalsy();
            expect(s.isRight()).toBeTruthy();
        });
    });

    describe('map()', () => {
        it('maps a function over its value', () => {
            const fn = (i: number): number => 2 * i;
            const val = 9;
            const r = Right.of(val);
            const s = r.map(fn);

            expect(s.isRight()).toBeTruthy();
            expect(s.value).toEqual(fn(val));
        });
    });

    describe('ap()', () => {
        it('applies a function wrapped in a Right over its value', () => {
            const fn = (i: number): number => 2 * i;
            const val = 9;
            const wrappedFn = Right.of(fn);
            const wrappedVal = Right.of(val);
            const wrappedResult = wrappedFn.ap(wrappedVal);

            expect(wrappedResult.isRight()).toBeTruthy();
            expect(wrappedResult.value).toEqual(fn(val));
        });
    });

    describe('join()', () => {
        it('flattens a nested Right', () => {
            const val = 9;
            const r = Right.of(Right.of(val));
            const s = r.join();

            expect(s.isRight()).toBeTruthy();
            expect(s.value).toEqual(val);
        });

        it('does nothing to a flat Right', () => {
            const val = 9;
            const r = Right.of(val);
            const s = r.join();

            expect(s.isRight()).toBeTruthy();
            expect(s.value).toEqual(val);
        });
    });

    describe('chain()', () => {
        it('applies a function that returns a Right to its value, and returns a Right with the result', () => {
            const val = 9;
            const fn = (i: number) => Right.of(2 * i);
            const r = Right.of(val);
            const s = r.chain(fn);

            expect(s.isRight()).toBeTruthy();
            expect(s.value).toEqual(fn(val).value);
        });
    });
});

describe('Left', () => {
    it('passes the Functor identity law', () => {
        const a = Left.of(9);
        const b = a.map(i => i);

        expect(a.value).toEqual(b.value);
    });

    it('passes the Functor composition law', () => {
        const double = (i: number): number => 2 * i;
        const add3 = (i: number): number => 3 + i;
        const val = 9;

        const lhs = Left.of<number, number>(val).map(compose<number, number, number>(double)(add3));
        const rhs = Left.of<number, number>(val).map(add3).map(double);

        expect(lhs.value).toEqual(rhs.value);
    });

    it('does not pass the Applicative identity law', () => {
        const a = Left.of(9);
        const b = Left.of((i: number): number => i);
        const result = b.ap(a);

        expect(result.value).not.toEqual(a.value) ;
    });

    it('does not pass the Applicative homomorphism law', () => {
        const val = 9;
        const fn = (i: number): number => 2 * i;
        const lhs = Left.of(fn).ap(Left.of(val));
        const rhs = Left.of(fn(val));

        expect(lhs.value).not.toEqual(rhs.value);
    });

    it('does not pass the Applicative interchange law', () => {
        const val = 9;
        const fn = (i: number): number => 2 * i;
        const vfn = (fn: (i: number) => number): number => fn(val);
        const lhs = Left.of(fn).ap(Left.of(val));
        const rhs = Left.of(vfn).ap(Left.of(fn));

        expect(lhs.value).not.toEqual(rhs.value);
    });

    it('does not pass the Applicative composition law', () => {
        const double = (i: number): number => 2 * i;
        const add3 = (i: number): number => 3 + i;
        const val = 9;
        const lhs = Left.of(compose).ap(Left.of(double)).ap(Left.of(add3)).ap(Left.of(val));
        const rhs = Left.of(double).ap(Left.of(add3).ap(Left.of(val)));

        expect(lhs.value).not.toEqual(rhs.value);
    });

    it('does not pass the Monad left identity law', () => {
        const double = (i: number): Left<number, number> => Left.of(2 * i);
        const val = 9;
        const lhs = Left.of<number, number>(val).chain(v => double(v));
        const rhs = double(val);

        expect(lhs.value).not.toEqual(rhs.value);
    });

    it('passes the Monad right identity law', () => {
        const val = 9;
        const lhs = Left.of<number, number>(val).chain(v => Left.of<number, number>(v));
        const rhs = Left.of(val);

        expect(lhs.value).toEqual(rhs.value);
    });

    it('passes the Monad associativity law', () => {
        const double = (i: number): Left<unknown, number> => Left.of(2 * i);
        const add3 = (i: number): Left<unknown, number> => Left.of(i + 3);
        const val = 9;
        const lhs = Left.of<unknown, number>(val).chain(x => add3(x).chain(double));
        const rhs = Left.of<unknown, number>(val).chain(add3).chain(double);

        expect(lhs.value).toEqual(rhs.value);
    });

    describe('of()', () => {
        it('creates a new Left value', () => {
            const a = 'some error message';
            const b = 'some other error message';
            const l = Left.of(a);
            const m = l.of(b);

            expect(l.value).toEqual(a);
            expect(l.isLeft()).toBeTruthy();
            expect(l.isRight()).toBeFalsy();
            expect(m.value).toEqual(b);
            expect(m.isLeft()).toBeTruthy();
            expect(m.isRight()).toBeFalsy();
        });
    });

    describe('map()', () => {
        it('does nothing', () => {
            const fn = (i: number): number => 2 * i;
            const val = 9;
            const l = Left.of<number, number>(val);
            const s = l.map(fn);

            expect(s.isLeft()).toBeTruthy();
            expect(s.value).toEqual(val);
            expect(s.value).not.toEqual(fn(val));
        });
    });

    describe('ap()', () => {
        it('does nothing', () => {
            const fn = (i: number): number => 2 * i;
            const val = 9;
            const wrappedFn = Right.of(fn);
            const wrappedVal = Left.of(val);
            const wrappedResult = wrappedFn.ap(wrappedVal);

            expect(wrappedResult.isLeft()).toBeTruthy();
            expect(wrappedResult.value).toEqual(val);
            expect(wrappedResult.value).not.toEqual(fn(val));
        });

        it('does nothing', () => {
            const fn = (i: number): number => 2 * i;
            const val = 9;
            const wrappedFn = Left.of(fn);
            const wrappedVal = Right.of(val);
            const wrappedResult = wrappedFn.ap(wrappedVal);

            expect(wrappedResult.isLeft()).toBeTruthy();
            expect(wrappedResult.value).toEqual(fn);
            expect(wrappedResult.value).not.toEqual(fn(val));
        });
    });

    describe('join()', () => {
        it('does nothing', () => {
            const val = 9;
            const container = Left.of(val);
            const a = Left.of(container);
            const b = a.join();

            expect(b.isLeft()).toBeTruthy();
            expect(b.value).toEqual(container);
        });

        it('does nothing', () => {
            const val = 9;
            const a = Left.of(val);
            const b = a.join();

            expect(b.isLeft()).toBeTruthy();
            expect(b.value).toEqual(val);
        });
    });


    describe('chain()', () => {
        it('does nothing', () => {
            const val = 9;
            const fn = (i: number) => Right.of<number, number>(2 * i);
            const a = Left.of<number, number>(val);
            const b = a.chain<number>(fn);

            expect(b.isLeft()).toBeTruthy();
            expect(b.value).toEqual(val);
            expect(b.value).not.toEqual(fn(val).value);
        });
    });
});

describe('left', () => {
    it('creates a new Left', () => {
        const val = 9;
        const l = left(val);

        expect(l.isLeft()).toBeTruthy();
        expect(l.value).toEqual(val);
    });
});

describe('right', () => {
    it('creates a new Right', () => {
        const val = 9;
        const r = right(val);

        expect(r.isRight()).toBeTruthy();
        expect(r.value).toEqual(val);
    });
});
