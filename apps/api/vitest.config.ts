import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: { NODE_ENV: 'test' },
    setupFiles: ['dotenv/config'],
    fileParallelism: false,
    include: ['tests/**/*.test.ts'],
  },
});
