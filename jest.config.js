module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/scripts/**',
    '!src/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFiles: ['<rootDir>/tests/setup.env.js'], // Set env vars FIRST
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'], // Then run setup
  testTimeout: 60000, // Increase timeout further for CI environments
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
  detectOpenHandles: true,
  forceExit: true
};






