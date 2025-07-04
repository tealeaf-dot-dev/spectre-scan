import { coverageConfigDefaults } from 'vitest/config';

export default {
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        silent: 'passed-only',
        clearMocks: true,
        restoreMocks: true,
        setupFiles: [],
        coverage: {
            exclude: [
                'tmp/**',
                ...coverageConfigDefaults.exclude,
            ]
        },
    }
}
