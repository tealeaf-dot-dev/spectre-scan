export interface IStoragePort<T> {
    store(params: T): Promise<void>,
}
