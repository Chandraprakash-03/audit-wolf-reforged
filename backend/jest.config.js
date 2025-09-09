module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/test/**',
        '!src/migrations/**',
    ],
    setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
    moduleNameMapping: {
        '^@supabase/supabase-js$': '<rootDir>/src/test/__mocks__/supabase.ts',
    },
};