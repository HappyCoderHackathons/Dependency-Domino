<script lang="ts">
	import type { Core, NodeSingular } from 'cytoscape';
	import { app } from '#lib/state.svelte.js';
	let { cy }: { cy: Core } = $props();
	let background: HTMLCanvasElement;
	let viewport: HTMLCanvasElement;
	const width = 168,
		height = 108,
		padding = 8;
	let transform: { x: number; y: number; scale: number; left: number; top: number } | null = null;
	let requestScene = () => {};
	$effect(() => {
		const instance = cy;
		let sceneFrame = 0,
			viewFrame = 0;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		for (const canvas of [background, viewport]) {
			canvas.width = width * dpr;
			canvas.height = height * dpr;
			canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
		}
		function drawViewport() {
			viewFrame = 0;
			const context = viewport.getContext('2d');
			if (!context || !transform || instance.destroyed()) return;
			context.clearRect(0, 0, width, height);
			const box = instance.extent();
			context.strokeStyle = '#38bdf8';
			context.fillStyle = 'rgb(56 189 248 / 0.1)';
			context.lineWidth = 1.5;
			const x = transform.left + (box.x1 - transform.x) * transform.scale;
			const y = transform.top + (box.y1 - transform.y) * transform.scale;
			context.fillRect(x, y, box.w * transform.scale, box.h * transform.scale);
			context.strokeRect(x, y, box.w * transform.scale, box.h * transform.scale);
		}
		function drawScene() {
			sceneFrame = 0;
			if (instance.destroyed()) return;
			const context = background.getContext('2d');
			if (!context) return;
			const points = instance
				.nodes()
				.not('.filtered')
				.map((node) => ({ ...(node as NodeSingular).position(), root: node.hasClass('root') }));
			context.clearRect(0, 0, width, height);
			if (!points.length) {
				transform = null;
				return;
			}
			let x = Infinity,
				y = Infinity,
				right = -Infinity,
				bottom = -Infinity;
			for (const point of points) {
				x = Math.min(x, point.x);
				y = Math.min(y, point.y);
				right = Math.max(right, point.x);
				bottom = Math.max(bottom, point.y);
			}
			const w = Math.max(40, right - x),
				h = Math.max(40, bottom - y);
			const scale = Math.min((width - padding * 2) / w, (height - padding * 2) / h);
			transform = { x, y, scale, left: (width - (right - x) * scale) / 2, top: (height - (bottom - y) * scale) / 2 };
			for (const point of points) {
				context.fillStyle = point.root ? '#38bdf8' : '#94a3b8';
				context.fillRect(
					transform.left + (point.x - x) * scale - 1,
					transform.top + (point.y - y) * scale - 1,
					point.root ? 4 : 2,
					point.root ? 4 : 2
				);
			}
			drawViewport();
		}
		const scene = () => {
			if (!sceneFrame) sceneFrame = requestAnimationFrame(drawScene);
		};
		const view = () => {
			if (!viewFrame) viewFrame = requestAnimationFrame(drawViewport);
		};
		requestScene = scene;
		instance.on('layoutstop add remove position', scene);
		instance.on('pan zoom resize', view);
		scene();
		return () => {
			cancelAnimationFrame(sceneFrame);
			cancelAnimationFrame(viewFrame);
			instance.off('layoutstop add remove position', scene);
			instance.off('pan zoom resize', view);
			requestScene = () => {};
		};
	});
	$effect(() => {
		void app.visibleIds;
		requestScene();
	});
	function panTo(event: PointerEvent) {
		if (!transform) return;
		const box = viewport.getBoundingClientRect();
		const x = transform.x + (event.clientX - box.left - transform.left) / transform.scale;
		const y = transform.y + (event.clientY - box.top - transform.top) / transform.scale;
		cy.stop();
		cy.pan({ x: cy.width() / 2 - x * cy.zoom(), y: cy.height() / 2 - y * cy.zoom() });
	}
	function keyboard(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			cy.center(cy.nodes());
			return;
		}
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [1, 0],
			ArrowRight: [-1, 0],
			ArrowUp: [0, 1],
			ArrowDown: [0, -1]
		};
		const move = moves[event.key];
		if (!move) return;
		event.preventDefault();
		cy.stop();
		cy.panBy({ x: (move[0] * cy.width()) / 5, y: (move[1] * cy.height()) / 5 });
	}
</script>

<div class="absolute bottom-3 left-3 z-10 rounded-lg bg-chassis/95 p-1.5 ring-1 ring-seam">
	<div class="relative h-[108px] w-[168px]">
		<canvas bind:this={background} aria-hidden="true" class="absolute inset-0 h-full w-full"></canvas>
		<canvas
			bind:this={viewport}
			role="button"
			tabindex="0"
			aria-label="Graph minimap. Click or drag to pan; arrow keys move the viewport."
			class="absolute inset-0 h-full w-full cursor-crosshair touch-none rounded focus-visible:outline-2 focus-visible:outline-downstream"
			onkeydown={keyboard}
			onpointerdown={(event) => {
				viewport.setPointerCapture(event.pointerId);
				panTo(event);
			}}
			onpointermove={(event) => {
				if (viewport.hasPointerCapture(event.pointerId)) panTo(event);
			}}
			onpointerup={(event) => viewport.releasePointerCapture(event.pointerId)}
		></canvas>
	</div>
	<p class="mt-1 text-center text-[10px] text-ink-muted">Displayed packages</p>
</div>
