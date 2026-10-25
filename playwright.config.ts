import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	forbidOnly: !!process.env.CI,
	workers: 1,
	use: {
		browserName: 'chromium',
		baseURL: 'http://127.0.0.1:4173',
		viewport: { width: 1440, height: 900 },
		reducedMotion: 'reduce',
		serviceWorkers: 'block',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	webServer: {
		command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: false
	}
});
