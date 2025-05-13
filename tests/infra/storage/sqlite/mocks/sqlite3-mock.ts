import { vi } from "vitest";

function createMockDatabase() {
    // run must look like a Node-style async fn or the promisified
    // version in SQLiteStorage will throw.
    const run = vi.fn(
        (
            _sql: string,
            paramsOrCb?: unknown[] | ((err: Error | null) => void),
            cb?: (err: Error | null) => void,
        ) => {
            const done = typeof paramsOrCb === 'function' ? paramsOrCb : cb ?? (() => void 0);

            process.nextTick(() => { done(null); }); // simulate success on next tick

            return this as unknown;             // keep it chain-friendly
        }
    );

    const Database = vi.fn().mockImplementation(function (
        this: { run: typeof run },           // 👈 add this line
        _path: string,
        callback?: (err: Error | null) => void,
    ) {
        this.run = run;                       // attach the spy to *this*
        callback?.(null);                     // signal “opened ok”
        // No explicit return → `this` becomes the instance that Vitest records
    });

    return { Database };
}

export default createMockDatabase();
