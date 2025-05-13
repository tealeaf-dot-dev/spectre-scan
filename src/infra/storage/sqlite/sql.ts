import { ISQL } from "./interfaces/ISQL.js";

export const sql: ISQL = {
    createPubkeyTable: `CREATE TABLE IF NOT EXISTS pubkeys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pubkey TEXT,
        date DATE,
        first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(pubkey, date))
        `,
    storePubkey: 'INSERT OR IGNORE INTO pubkeys (pubkey, date) VALUES (?, ?)',
};
