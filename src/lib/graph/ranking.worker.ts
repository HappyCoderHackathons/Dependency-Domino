import { rankByImpact } from '#lib/graph/ranking.js';
import type { DependencyGraph } from '#lib/types.js';

self.onmessage = ({ data }: MessageEvent<DependencyGraph>) => {
	self.postMessage(rankByImpact(data).slice(0, 10));
};
