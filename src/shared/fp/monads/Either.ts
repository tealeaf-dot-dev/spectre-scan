import { IMonad } from "./IMonad.js";

export abstract class Either<A, B> implements IMonad<B> {
    abstract value: A|B;
    abstract of(c: A|B): Either<A,B>;
    abstract ap<C, D, E>(app: Either<C, D>): Either<A|C, E>;
    abstract map<C>(fn: (b: B) => C): Either<A, C>;
    abstract join<C>(): Either<A, B|C>;
    abstract chain<C>(fn: (b: B) => Either<A, C>): Either<A, C>;
    abstract isLeft(): this is Left<A, B>;
    abstract isRight(): this is Right<A, B>;
}

export class Right<A, B> extends Either<A, B> {
    readonly #_value: B;

    private constructor(value: B) {
        super();
        this.#_value = value;
    }

    get value(): B {

        return this.#_value;
    }

    static of<C, D>(d: D): Right<C, D> {

        return new Right(d);
    }

    of(b: B): Right<A, B> {

        return Right.of(b);
    }

    ap<C, D, E>(e: Either<C, D>): Either<A|C, E> {

        return e.map(this.value as (b: D) => E);
    }

    map<C>(fn: (b: B) => C): Right<A, C> {

        return Right.of<A, C>(fn(this.value));
    }

    join<C>(): Either<A, B|C> {

        return this.value instanceof Either ? this.value : Right.of(this.value);
    }

    chain<C>(fn: (b: B) => Either<A, C>): Either<A, C> {

        return fn(this.value);
    }

    isLeft(): this is Left<A, B> {

        return false;
    }

    isRight(): this is Right<A, B> {

        return true;
    }
}

export class Left<A, B> extends Either<A, B> {
    readonly #_value: A;

    private constructor(value: A) {
        super();
        this.#_value = value;
    }

    get value(): A {

        return this.#_value;
    }

    isLeft(): this is Left<A, B> {

        return true;
    }

    isRight(): this is Right<A, B> {

        return false;
    }

    static of<C, D>(c: C): Left<C, D> {

        return new Left(c);
    }

    of(a: A): Left<A, B> {

        return Left.of(a);
    }

    ap<C, D, E>(_e: Either<C, D>): Either<A|C, E> {

        return Left.of(this.value);
    }

    map<C>(_fn: (b: B) => C): Left<A, C> {

        return Left.of(this.value);
    }

    join<C>(): Either<A, B|C> {

        return Left.of(this.value);
    }

    chain<C>(_fn: (b: B) => Either<A, C>): Either<A, C> {

        return Left.of(this.value);
    }
}

export function left<A, B>(a: A): Left<A, B> {

    return Left.of(a);
};

export function right<A, B>(b: B): Right<A, B> {

    return Right.of(b);
};
