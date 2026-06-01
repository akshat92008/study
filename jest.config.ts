const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Must match tsconfig.json paths exactly
    '^@/db/(.*)$': '<rootDir>/lib/db/$1',
    '^@/services/(.*)$': '<rootDir>/lib/services/$1',
    '^@/graph/(.*)$': '<rootDir>/lib/graph/$1',
    '^@/telemetry/(.*)$': '<rootDir>/lib/telemetry/$1',
    '^@/alerts/(.*)$': '<rootDir>/lib/alerts/$1',
    '^@/planners/(.*)$': '<rootDir>/lib/planners/$1',
    '^@/engines/(.*)$': '<rootDir>/lib/engines/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/tests/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Override strict module settings for test environment
        module: 'commonjs',
        moduleResolution: 'node',
      },
    }],
  },
  // Don't try to transform Next.js internals
  transformIgnorePatterns: ['/node_modules/(?!(your-esm-package)/)'],
  setupFilesAfterEnv: [],
};

export default config;
