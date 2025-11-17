import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/js/**/*.js'],
      exclude: ['src/js/main.js', '**/*.test.js']
    }
  }
});
