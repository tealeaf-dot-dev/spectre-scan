export const SCANNER_STATUS = {
    Started: 'started',
    Stopped: 'stopped',
    NeverStarted: 'never started',
} as const;

export type ScannerStatus = typeof SCANNER_STATUS[keyof typeof SCANNER_STATUS];
