import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 120000,
    hookTimeout: 30000,
    dir: 'tests',
    globals: true,
    env: {
      NODE_ENV: 'test',
      AGENT_PORT: '3848',
      DAILY_API_SPEND_CAP_USD: '1.00',
    },
  },
});
