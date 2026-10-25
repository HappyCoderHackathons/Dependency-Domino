export interface Position {
	x: number;
	y: number;
}

/**
 * Node positions from finished layouts, keyed first by layout (direction + revealed set) and then by node
 * id. Filters never enter the key: they only toggle visibility, so toggling them reuses the same positions.
 */
export class LayoutCache {
	#entries = new Map<string, Map<string, Position>>();
	#limit: number;

	constructor(limit = 12) {
		this.#limit = limit;
	}

	/** Cached positions for `key`, or null when absent or missing any of the ids that now need placing. */
	get(key: string, ids: Iterable<string>): Map<string, Position> | null {
		const positions = this.#entries.get(key);
		if (!positions) return null;
		for (const id of ids) if (!positions.has(id)) return null;
		return positions;
	}

	set(key: string, positions: Map<string, Position>): void {
		this.#entries.delete(key);
		this.#entries.set(key, positions);
		while (this.#entries.size > this.#limit) {
			const oldest = this.#entries.keys().next().value;
			if (oldest === undefined) break;
			this.#entries.delete(oldest);
		}
	}

	/** A different graph was loaded: no stored position is meaningful any more. */
	clear(): void {
		this.#entries.clear();
	}

	get size(): number {
		return this.#entries.size;
	}
}