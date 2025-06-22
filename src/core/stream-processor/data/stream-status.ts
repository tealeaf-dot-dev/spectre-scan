export const STREAM_STATUS = {
    Started: 'started',
    Stopped: 'stopped',
    NeverStarted: 'never started',
} as const;

export type StreamStatus = typeof STREAM_STATUS[keyof typeof STREAM_STATUS];
