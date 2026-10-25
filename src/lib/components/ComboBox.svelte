<script lang="ts" generics="T extends string | number">
	import { flushSync, tick } from 'svelte';
	import Icon from '#lib/icons.js';

	interface Option {
		value: T;
		label: string;
		disabled?: boolean;
	}
	interface Props {
		id: string;
		label: string;
		value: T;
		options: readonly Option[];
		disabled?: boolean;
	}
	let { id, label, value = $bindable(), options, disabled = false }: Props = $props();
	let trigger: HTMLButtonElement;
	let popup: HTMLDivElement;
	let open = $state(false);
	let active = $state(-1);
	let left = $state(0);
	let top = $state(0);
	let width = $state(0);
	let maxHeight = $state(240);
	let typed = '';
	let typedAt = 0;
	const selected = $derived(options.find((option) => option.value === value));
	const enabled = $derived(options.flatMap((option, index) => (option.disabled ? [] : [index])));

	function close() {
		open = false;
		typed = '';
		if (popup?.matches(':popover-open')) popup.hidePopover();
	}

	function place() {
		const rect = trigger.getBoundingClientRect();
		if (rect.bottom < 8 || rect.top > window.innerHeight - 8) return close();
		width = Math.min(Math.max(rect.width, 240), window.innerWidth - 16);
		left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
		const below = window.innerHeight - rect.bottom - 14;
		const above = rect.top - 14;
		const upwards = below < Math.min(options.length * 40 + 8, 240) && above > below;
		maxHeight = Math.max(0, Math.min(240, upwards ? above : below));
		top = upwards ? rect.top - Math.min(popup.scrollHeight, maxHeight) - 6 : rect.bottom + 6;
	}

	async function show() {
		if (disabled || enabled.length === 0) return;
		active = options.findIndex((option) => option.value === value && !option.disabled);
		if (active < 0) active = enabled[0];
		open = true;
		await tick();
		if (!open) return;
		place();
		await tick();
		if (!open) return;
		popup.showPopover();
		place();
		await tick();
		if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' });
	}

	function choose(index: number, restoreFocus = true) {
		const option = options[index];
		if (!option || option.disabled) return;
		value = option.value;
		close();
		if (restoreFocus) trigger.focus();
	}

	function step(amount: number) {
		const position = Math.max(0, enabled.indexOf(active));
		active = enabled[Math.max(0, Math.min(enabled.length - 1, position + amount))];
	}

	async function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Tab') {
			// Update conditional controls before the browser chooses the next tab stop.
			if (open) flushSync(() => choose(active, false));
			return;
		}
		if (event.key === 'Escape' && open) {
			event.preventDefault();
			event.stopPropagation();
			close();
			return;
		}
		if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(event.key)) {
			event.preventDefault();
			if ((event.key === 'Enter' || event.key === ' ') && open) return choose(active);
			if (event.altKey && event.key === 'ArrowUp' && open) return choose(active);
			const wasOpen = open;
			if (!open) await show();
			if (!open) return;
			if (event.key === 'Home') active = enabled[0];
			else if (event.key === 'End') active = enabled[enabled.length - 1];
			else if (wasOpen && event.key === 'ArrowDown') step(1);
			else if (wasOpen && event.key === 'ArrowUp') step(-1);
			else if (event.key === 'PageDown') step(10);
			else if (event.key === 'PageUp') step(-10);
			return;
		}
		if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
			event.preventDefault();
			if (!open) await show();
			if (!open) return;
			const now = Date.now();
			typed = (now - typedAt > 700 ? '' : typed) + event.key.toLowerCase();
			typedAt = now;
			const repeated = [...typed].every((char) => char === typed[0]);
			const prefix = repeated ? typed[0] : typed;
			const start = repeated ? enabled.indexOf(active) + 1 : 0;
			for (let offset = 0; offset < enabled.length; offset++) {
				const index = enabled[(start + offset) % enabled.length];
				if (options[index].label.toLowerCase().startsWith(prefix)) {
					active = index;
					break;
				}
			}
		}
	}

	$effect(() => {
		if (disabled) close();
	});
	$effect(() => {
		if (!open) return;
		const index = active;
		void tick().then(() => {
			if (open) document.getElementById(`${id}-option-${index}`)?.scrollIntoView({ block: 'nearest' });
		});
	});
	$effect(() => {
		if (!open) return;
		function outside(event: PointerEvent) {
			if (event.target instanceof Node && !trigger.contains(event.target) && !popup.contains(event.target)) close();
		}
		function scroll(event: Event) {
			if (event.target instanceof Node && popup.contains(event.target)) return;
			place();
		}
		window.addEventListener('pointerdown', outside, true);
		window.addEventListener('resize', close);
		window.addEventListener('scroll', scroll, true);
		return () => {
			window.removeEventListener('pointerdown', outside, true);
			window.removeEventListener('resize', close);
			window.removeEventListener('scroll', scroll, true);
		};
	});
</script>

<button
	bind:this={trigger}
	{id}
	type="button"
	role="combobox"
	aria-label={label}
	aria-expanded={open}
	aria-controls={`${id}-listbox`}
	aria-haspopup="listbox"
	aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
	{disabled}
	onclick={() => (open ? close() : show())}
	onkeydown={onKeydown}
	onblur={(event) => {
		if (!(event.relatedTarget instanceof Node) || !popup.contains(event.relatedTarget)) close();
	}}
	class="flex w-full items-center justify-between gap-3 rounded-lg bg-layer-2 px-3 py-2 text-left text-sm text-ink ring-1 ring-seam transition-colors hover:bg-layer-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-downstream disabled:cursor-not-allowed disabled:opacity-50"
>
	<span class="min-w-0 leading-snug wrap-break-word">{selected?.label ?? 'Choose an option'}</span>
	<Icon icon="mdi:chevron-down" width="16" height="16" class="shrink-0 text-ink-muted" />
</button>

<div
	bind:this={popup}
	id={`${id}-listbox`}
	popover="manual"
	role="listbox"
	aria-label={`${label} options`}
	style={`inset:auto;left:${left}px;top:${top}px;width:${width}px;max-height:${maxHeight}px`}
	class="fixed m-0 overflow-y-auto rounded-xl border-0 bg-chassis p-1 text-sm text-ink shadow-2xl ring-1 ring-seam"
>
	{#each options as option, index (option.value)}
		<button
			id={`${id}-option-${index}`}
			type="button"
			role="option"
			tabindex="-1"
			aria-selected={active === index}
			aria-disabled={option.disabled ?? false}
			disabled={option.disabled}
			onmousedown={(event) => event.preventDefault()}
			onpointermove={() => {
				if (!option.disabled) active = index;
			}}
			onclick={() => choose(index)}
			class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left leading-snug wrap-break-word hover:bg-layer-2 disabled:cursor-not-allowed disabled:opacity-40 aria-selected:bg-layer-3 aria-selected:text-downstream"
		>
			<span
				aria-hidden="true"
				class="size-1.5 shrink-0 rounded-full {active === index ? 'bg-downstream' : 'bg-transparent'}"
			></span>
			{option.label}
		</button>
	{/each}
</div>
