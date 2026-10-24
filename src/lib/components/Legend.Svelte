<script lang="ts">
	import { COLORS } from '#lib/graph/theme.ts';

	const row = 'flex items-center gap-2';
	const swatchBox = 'flex w-7 shrink-0 items-center justify-center';
</script>

<ul class="mt-2 space-y-2 text-sm text-slate-700">
	<li class={row}>
		<span class={swatchBox}>
			<span class="block h-3.5 w-6 rounded-sm" style:background-color={COLORS.root}></span>
		</span>
		Project root
	</li>
	<li class={row}>
		<span class={swatchBox}>
			<span class="block size-3.5 rounded-full" style:background-color={COLORS.node}></span>
		</span>
		Package
	</li>
	<li class={row}>
		<span class={swatchBox}>
			<span
				class="block size-3.5 rounded-full border-2"
				style:background-color={COLORS.origin}
				style:border-color={COLORS.originBorder}
			></span>
		</span>
		Hypothetical origin
	</li>
	<li class={row}>
		<span class={swatchBox}>
			<span
				class="block size-3.5 rounded-full border-2"
				style:background-color={COLORS.affected}
				style:border-color={COLORS.affectedBorder}
			></span>
		</span>
		Depends on the origin
	</li>
	<li class={row}>
		<span class={swatchBox}>
			<span
				class="block w-7 border-t-2"
				style:border-top-style="dashed"
				style:border-top-color={COLORS.unresolved}
			></span>
		</span>
		Unresolved or unsupported
	</li>
	<li class={row}>
		<span class={swatchBox}>
			<span
				class="block w-7 border-t-2"
				style:border-top-style="dotted"
				style:border-top-color={COLORS.devEdge}
			></span>
		</span>
		Development dependency
	</li>
	<li class={row}>
		<span class={swatchBox}>
			<span class="block w-7 border-t-4" style:border-top-color={COLORS.pathEdge}></span>
		</span>
		Sample path to the origin
	</li>
</ul>