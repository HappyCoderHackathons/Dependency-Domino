import type { Core } from 'cytoscape';
import { COLORS } from '#lib/graph/theme.js';

/** Preserve current styling, including filters and playback. Full exports add room for label overhang. */
export async function createGraphPng(cy: Core, full: boolean): Promise<Blob> {
	const viewport = { zoom: cy.zoom(), pan: { ...cy.pan() } };
	const width = cy.width(),
		height = cy.height();
	let image: Promise<Blob>;
	let crop: { x: number; y: number; w: number; h: number } | null = null;
	try {
		// png() snapshots pixels before asynchronous encoding; restore before the browser can paint.
		if (full) {
			cy.fit(cy.elements(), Math.min(100, Math.min(width, height) / 4));
			const bounds = cy.elements().renderedBoundingBox();
			const padding = 64;
			const x = Math.max(0, bounds.x1 - padding),
				y = Math.max(0, bounds.y1 - padding);
			crop = { x, y, w: Math.min(width, bounds.x2 + padding) - x, h: Math.min(height, bounds.y2 + padding) - y };
		}
		image = cy.png({
			output: 'blob-promise',
			bg: COLORS.canvas,
			full: false,
			maxWidth: full ? 4096 : Math.min(4096, width * 2),
			maxHeight: full ? 4096 : Math.min(4096, height * 2)
		});
	} finally {
		if (full && !cy.destroyed()) cy.viewport(viewport);
	}
	const blob = await image;
	if (!crop) return blob;
	const bitmap = await createImageBitmap(blob);
	try {
		const sx = bitmap.width / width,
			sy = bitmap.height / height;
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(crop.w * sx));
		canvas.height = Math.max(1, Math.round(crop.h * sy));
		const context = canvas.getContext('2d');
		if (!context) throw new Error('Canvas is unavailable.');
		context.drawImage(bitmap, crop.x * sx, crop.y * sy, crop.w * sx, crop.h * sy, 0, 0, canvas.width, canvas.height);
		return await new Promise<Blob>((resolve, reject) =>
			canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('PNG encoding failed.'))), 'image/png')
		);
	} finally {
		bitmap.close();
	}
}
