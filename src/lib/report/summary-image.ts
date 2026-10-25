import type { SummaryCard } from './summary-card';
import { REPORT_DISCLAIMER } from './report';
import { COLORS } from '#lib/graph/theme.js';
import logoMark from '#lib/assets/logo-mark.svg?url';

const WIDTH = 1600,
	HEIGHT = 900;
const INK = '#e2e8f0',
	MUTED = '#94a3b8',
	CHASSIS = '#0f172a',
	PANEL = '#1e293b';

function safeText(value: string): string {
	return value.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ').slice(0, 400);
}

function text(
	context: CanvasRenderingContext2D,
	value: string,
	x: number,
	y: number,
	maxWidth: number,
	lineHeight: number,
	maxLines = 1
) {
	const chars = Array.from(safeText(value));
	let line = '',
		lines = 0;
	for (let i = 0; i < chars.length; i++) {
		if (context.measureText(line + chars[i]).width > maxWidth && line) {
			if (lines === maxLines - 1) {
				while (context.measureText(line + '…').width > maxWidth && line) line = line.slice(0, -1);
				context.fillText(line + '…', x, y + lines * lineHeight);
				return;
			}
			context.fillText(line, x, y + lines++ * lineHeight);
			line = '';
		}
		line += chars[i];
	}
	context.fillText(line, x, y + lines * lineHeight);
}

function panel(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
	context.fillStyle = PANEL;
	context.beginPath();
	context.roundRect(x, y, w, h, 16);
	context.fill();
}

export async function createSummaryPng(data: SummaryCard): Promise<Blob> {
	await document.fonts.ready;
	await Promise.all([
		document.fonts.load('600 48px "Geist Variable"'),
		document.fonts.load('400 22px "Geist Mono Variable"')
	]);
	const canvas = document.createElement('canvas');
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Canvas is unavailable.');
	context.fillStyle = CHASSIS;
	context.fillRect(0, 0, WIDTH, HEIGHT);
	const logo = new Image();
	logo.src = logoMark;
	await logo.decode();
	context.drawImage(logo, 64, 46, 64, 64);
	context.fillStyle = INK;
	context.font = '600 30px "Geist Variable", sans-serif';
	context.fillText('Dependency Domino', 148, 78);
	context.fillStyle = MUTED;
	context.font = '400 18px "Geist Variable", sans-serif';
	context.fillText('SUPPLY CHAIN IMPACT ANALYSIS', 148, 107);
	context.fillStyle = COLORS.origin;
	context.font = '600 18px "Geist Variable", sans-serif';
	context.fillText('HYPOTHETICAL EXPOSURE', 1262 - context.measureText('HYPOTHETICAL EXPOSURE').width / 2, 85);
	context.strokeStyle = '#475569';
	context.lineWidth = 1;
	context.beginPath();
	context.moveTo(64, 144);
	context.lineTo(1536, 144);
	context.stroke();
	context.fillStyle = MUTED;
	context.font = '400 22px "Geist Variable", sans-serif';
	text(context, `Project: ${data.project}`, 64, 189, 1472, 26);
	context.fillText(
		data.origins.length === 1 ? 'ASSUMED ORIGIN' : `ASSUMED ORIGINS · ${data.origins.length} INSTALLED INSTANCES`,
		64,
		231
	);
	if (data.origins.length === 1) {
		context.fillStyle = COLORS.originBorder;
		context.font = '600 48px "Geist Variable", sans-serif';
		const nameWidth = context.measureText(safeText(data.origins[0].name)).width;
		const nameSize = Math.max(32, Math.min(48, Math.floor((48 * 1472 * 1.8) / Math.max(1, nameWidth))));
		context.font = `600 ${nameSize}px "Geist Variable", sans-serif`;
		text(context, data.origins[0].name, 64, 282, 1472, 46, 2);
		context.fillStyle = MUTED;
		context.font = '400 22px "Geist Mono Variable", monospace';
		text(context, data.origins[0].version ?? 'Unknown version', 64, 367, 1472, 26);
	} else {
		for (const [i, origin] of data.origins.slice(0, 2).entries()) {
			context.fillStyle = COLORS.originBorder;
			context.font = '600 32px "Geist Variable", sans-serif';
			text(context, origin.name, 64, 278 + i * 44, 1080, 38);
			context.fillStyle = MUTED;
			context.font = '400 22px "Geist Mono Variable", monospace';
			text(context, origin.version ?? 'Unknown version', 1170, 278 + i * 44, 366, 26);
		}
		if (data.origins.length > 2) {
			context.fillStyle = MUTED;
			context.font = '400 20px "Geist Variable", sans-serif';
			context.fillText(`+ ${data.origins.length - 2} more installed origin instances`, 64, 359);
		}
	}
	const metrics = [
		['Dependent instances', String(data.affected), COLORS.affected],
		['Shortest hops to root', data.hopsToRoot === null ? 'No path' : String(data.hopsToRoot), INK],
		['Origin instances', String(data.origins.length), COLORS.originBorder]
	];
	const metricWidth = (1472 - 48) / 3;
	metrics.forEach(([label, value, color], i) => {
		const x = 64 + i * (metricWidth + 24);
		panel(context, x, 390, metricWidth, 124);
		context.fillStyle = MUTED;
		context.font = '400 22px "Geist Variable", sans-serif';
		context.fillText(label, x + 24, 427);
		context.fillStyle = color;
		context.font = '600 52px "Geist Variable", sans-serif';
		context.fillText(value, x + 24, 486);
	});
	context.fillStyle = MUTED;
	context.font = '400 20px "Geist Variable", sans-serif';
	context.fillText('Dependent counts exclude the origins and project root.', 64, 547);
	context.fillStyle = INK;
	context.font = '600 22px "Geist Variable", sans-serif';
	context.fillText(
		data.pathHops === null
			? 'No recorded path from project root'
			: `Selected sample route · ${data.pathHops} dependency hops`,
		64,
		590
	);
	if (data.path.length) {
		const gap = 28,
			w = Math.min(350, (1472 - (data.path.length - 1) * gap) / data.path.length);
		data.path.forEach((node, i) => {
			const x = 64 + i * (w + gap);
			panel(context, x, 612, w, 120);
			context.strokeStyle = i === data.path.length - 1 ? COLORS.origin : i === 0 ? COLORS.root : '#475569';
			context.lineWidth = 2;
			context.beginPath();
			context.roundRect(x, 612, w, 120, 16);
			context.stroke();
			context.fillStyle = node ? INK : MUTED;
			context.font = '500 21px "Geist Variable", sans-serif';
			text(context, node?.name ?? `${data.omittedPackages} packages omitted`, x + 16, 643, w - 32, 25, 2);
			if (node) {
				context.fillStyle = MUTED;
				context.font = '400 17px "Geist Mono Variable", monospace';
				text(context, node.version ?? 'Unknown version', x + 16, 710, w - 32, 20);
			}
			if (i < data.path.length - 1) {
				context.strokeStyle = '#64748b';
				context.lineWidth = 2;
				context.beginPath();
				context.moveTo(x + w + 5, 672);
				context.lineTo(x + w + gap - 5, 672);
				context.lineTo(x + w + gap - 11, 667);
				context.moveTo(x + w + gap - 5, 672);
				context.lineTo(x + w + gap - 11, 677);
				context.stroke();
			}
		});
	}
	context.strokeStyle = '#475569';
	context.beginPath();
	context.moveTo(64, 766);
	context.lineTo(1536, 766);
	context.stroke();
	context.fillStyle = MUTED;
	context.font = '400 22px "Geist Variable", sans-serif';
	text(context, REPORT_DISCLAIMER, 64, 803, 1472, 28, 3);
	return await new Promise<Blob>((resolve, reject) =>
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG encoding failed.'))), 'image/png')
	);
}
