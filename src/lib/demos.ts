import demoLockfile from '#lib/fixtures/demo-lockfile.json';

export type DemoId = 'small' | 'real';

export interface Demo {
	id: DemoId;
	label: string;
	description: string;
	/** Shown in the top bar and used in export filenames. */
	sourceLabel: string;
	load: () => Promise<string>;
}

export const DEMOS: Demo[] = [
	{
		id: 'small',
		label: 'Small example',
		description: 'A hand-written app with 14 packages',
		sourceLabel: 'demo (bundled)',
		load: async () => JSON.stringify(demoLockfile)
	},
	{
		id: 'real',
		label: 'Real project',
		description: 'The yargs repository, about 560 packages',
		sourceLabel: 'demo: yargs/yargs (package-lock.json)',
		load: async () => (await import('#lib/fixtures/demos/yargs-package-lock.json?raw')).default
	}
];

export function demoById(id: DemoId): Demo {
	return DEMOS.find((demo) => demo.id === id)!;
}
