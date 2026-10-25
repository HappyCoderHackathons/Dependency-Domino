import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	// Prebundle lazy graph and worker imports so their first use does not reload the dev page.
	optimizeDeps: {
		include: ['cytoscape', 'cytoscape-dagre', '@yarnpkg/parsers', 'jsonc-parser', 'yaml']
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
			},

			// Deployed on Vercel. The OSV endpoints need a server runtime, so a static adapter will not work.
			adapter: adapter({ runtime: 'nodejs24.x' })
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
