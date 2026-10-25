import type { PackageNode } from '#lib/types.js';

function slug(value: string, fallback: string): string {
	return (
		value
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.slice(0, 60)
			.replace(/^-+|-+$/g, '') || fallback
	);
}

export function pngFilename(
	source: string | null,
	origins: Pick<PackageNode, 'name'>[],
	kind: 'graph-view' | 'graph-full' | 'summary'
): string {
	const origin = origins.length
		? `-${slug(origins[0].name, 'package')}${origins.length > 1 ? `-plus-${origins.length - 1}` : ''}`
		: '';
	return `dependency-domino-${slug(source ?? '', 'lockfile')}${origin}-${kind}.png`;
}

export function downloadPng(blob: Blob, filename: string): void {
	if (blob.type !== 'image/png' || blob.size === 0) throw new Error('PNG encoding failed.');
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	try {
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
	} finally {
		link.remove();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
}
