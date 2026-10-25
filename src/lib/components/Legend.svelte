<script lang="ts">
	import { COLORS } from '#lib/graph/theme.ts';

	const row = 'flex items-center gap-2.5 px-2 py-0.5';
	const swatchBox = 'flex w-7 shrink-0 items-center justify-center';
</script>

<ul class="space-y-1 text-[13px] text-ink-muted">
	<li class={row}>
		<span class={swatchBox}>
			<span
				class="block h-3 w-6 rounded-sm border"
				style:background-color={COLORS.root}
				style:border-color={COLORS.rootBorder}
			></span>
		</span>
		Project root
	</li>
	<li class={row}>
		<span class={swatchBox}>
			<span
				class="block size-3 rounded-full border"
				style:background-color={COLORS.node}
				style:border-color={COLORS.nodeBorder}
			></span>
		</span>
		Installed package
	</li>
	<li class={row}>
		<span class={swatchBox}>
			<span class="block size-3.5 rounded-full border-4 border-double" style:border-color={COLORS.advisory}></span>
		</span>
		Known advisory (OSV)
	</li>
	<li class={row}>
		<span class={swatchBox}>
			<span
				class="block size-3 rotate-45 rounded-sm border-2"
				style:background-color={COLORS.installScript}
				style:border-color={COLORS.installScriptBorder}
			></span>
		</span>
		Runs a script at install time
	</li>
	<li class={row}>
		<span class={swatchBox}>
			<span
				class="block size-3 rounded-full border-2 border-dashed"
				style:background-color={COLORS.unsupportedFill}
				style:border-color={COLORS.unresolved}
			></span>
		</span>
		Unresolved or unsupported source
	</li>
	<li class={row}>
		<span class={swatchBox}>
			<span class="block w-6 border-t-2 border-dotted" style:border-top-color={COLORS.nodeBorder}></span>
		</span>
		Development dependency
	</li>
	<li class="mt-2 {row}">
		<span class={swatchBox}>
			<span
				class="block size-3.5 rounded-full border-2"
				style:background-color={COLORS.origin}
				style:border-color={COLORS.originBorder}
				style:box-shadow="0 0 0 3px rgb(244 63 94 / 0.3)"
			></span>
		</span>
		Hypothetical origin
	</li>
	<li class={row}>
		<span class={swatchBox}>
			<span
				class="block size-3 rounded-full border-2"
				style:background-color={COLORS.affected}
				style:border-color={COLORS.affectedBorder}
			></span>
		</span>
		Depends on the origin
	</li>
	<li class={row}>
		<span class={swatchBox}>
			<span class="block w-6 border-t-4" style:border-top-color={COLORS.pathEdge}></span>
		</span>
		Sample path to the origin
	</li>
</ul>
