declare const verifiedSymbol: unique symbol;

export interface IEvent {
    kind: number;
    tags: string[][];
    content: string;
    created_at: number;
    pubkey: string;
    id: string;
    sig: string;
    [verifiedSymbol]?: boolean;
}
