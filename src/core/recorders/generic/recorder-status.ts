export const RECORDER_STATUS = {
    Started: 'started',
    Stopped: 'stopped',
    NeverStarted: 'never started',
} as const;

export type RecorderStatus = typeof RECORDER_STATUS[keyof typeof RECORDER_STATUS];
