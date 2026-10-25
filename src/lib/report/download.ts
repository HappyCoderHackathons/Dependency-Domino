export type ReportFormat = 'json' | 'markdown';

/** Fixed filenames avoid using imported package names as filesystem paths. */
export function downloadReport(content: string, format: ReportFormat): void {
	const extension = format === 'json' ? 'json' : 'md';
	const type = format === 'json' ? 'application/json' : 'text/markdown';
	const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
	const link = document.createElement('a');
	try {
		link.href = url;
		link.download = `dependency-domino-report.${extension}`;
		document.body.appendChild(link);
		link.click();
	} finally {
		link.remove();
		// Allow the browser to start consuming the download before releasing the URL.
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
}
