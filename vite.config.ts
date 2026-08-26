/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * GitHub Pages serves a project site from https://<user>.github.io/<repo>/, so the
 * production build needs that sub-path baked in. The dev server keeps the root path.
 *
 * Change REPO_BASE if the repository is renamed, or set it to '/' for a user/org site.
 */
const REPO_BASE = '/crypto-site/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? REPO_BASE : '/',
  plugins: [react(), tailwindcss()],
  test: {
    // Every cipher is plain TypeScript, so the default test environment has no DOM.
    // Add a jsdom project here if component tests arrive later.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
}));
