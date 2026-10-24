<script lang="ts">
	interface Props {
		variant?: 'mark' | 'full';
		class?: string;
		title?: string;
	}

	let { variant = 'mark', class: className = 'size-12', title = 'Dependency Domino' }: Props = $props();
</script>

{#if variant === 'full'}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 380 96"
		fill="none"
		class={className}
		role="img"
		aria-label={title}
	>
		<defs>
			<linearGradient id="bl-logo-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color="#1e293b" />
				<stop offset="100%" stop-color="#090d16" />
			</linearGradient>
			<linearGradient id="bl-logo-grad2" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color="#334155" />
				<stop offset="100%" stop-color="#1e293b" />
			</linearGradient>
			<linearGradient id="bl-logo-alert" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color="#fb7185" />
				<stop offset="100%" stop-color="#e11d48" />
			</linearGradient>
			<linearGradient id="bl-logo-sky" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color="#38bdf8" />
				<stop offset="100%" stop-color="#0284c7" />
			</linearGradient>
			<filter id="bl-logo-glow" x="-30%" y="-30%" width="160%" height="160%">
				<feGaussianBlur stdDeviation="2.5" result="blur" />
				<feComposite in="SourceGraphic" in2="blur" operator="over" />
			</filter>
		</defs>

		<!-- Brand Mark (left) -->
		<g transform="translate(10, 0)">
			<!-- Domino 2 -->
			<g transform="translate(62, 51) rotate(24)">
				<rect
					x="-12"
					y="-25"
					width="24"
					height="50"
					rx="5.5"
					fill="url(#bl-logo-grad2)"
					stroke="#475569"
					stroke-width="1.5"
				/>
				<line x1="-8" y1="0" x2="8" y2="0" stroke="#475569" stroke-width="1.5" stroke-linecap="round" />
				<circle cx="0" cy="-12" r="3.6" fill="#f59e0b" />
				<line x1="0" y1="8" x2="-5" y2="16" stroke="#475569" stroke-width="1.2" />
				<line x1="0" y1="8" x2="5" y2="16" stroke="#475569" stroke-width="1.2" />
				<circle cx="0" cy="8" r="2.6" fill="url(#bl-logo-sky)" />
				<circle cx="-5" cy="16" r="2.6" fill="url(#bl-logo-sky)" />
				<circle cx="5" cy="16" r="2.6" fill="url(#bl-logo-sky)" />
			</g>

			<!-- Cascade Impact Arc -->
			<path
				d="M37 31 C 45 27, 54 31, 62 37"
				stroke="#f43f5e"
				stroke-width="1.6"
				stroke-dasharray="2.5 2"
				opacity="0.85"
			/>

			<!-- Domino 1 -->
			<g transform="translate(35, 47) rotate(-14)">
				<rect
					x="-14"
					y="-29"
					width="28"
					height="58"
					rx="6.5"
					fill="#000000"
					opacity="0.4"
					transform="translate(1.5, 2)"
				/>
				<rect
					x="-14"
					y="-29"
					width="28"
					height="58"
					rx="6.5"
					fill="url(#bl-logo-grad1)"
					stroke="#64748b"
					stroke-width="1.8"
				/>
				<line x1="-10" y1="0" x2="10" y2="0" stroke="#475569" stroke-width="1.8" stroke-linecap="round" />

				<line x1="0" y1="-14" x2="-7" y2="14" stroke="#64748b" stroke-width="1.4" />
				<line x1="0" y1="-14" x2="7" y2="14" stroke="#64748b" stroke-width="1.4" />
				<line x1="-7" y1="14" x2="7" y2="14" stroke="#334155" stroke-width="1" />

				<circle cx="0" cy="-14" r="7.5" fill="#f43f5e" opacity="0.25" filter="url(#bl-logo-glow)" />
				<circle cx="0" cy="-14" r="4.5" fill="url(#bl-logo-alert)" />
				<circle cx="0" cy="-14" r="1.6" fill="#ffffff" opacity="0.9" />

				<circle cx="-7" cy="14" r="3.6" fill="url(#bl-logo-sky)" />
				<circle cx="7" cy="14" r="3.6" fill="url(#bl-logo-sky)" />
			</g>
		</g>

		<!-- Wordmark and Subtitle -->
		<g transform="translate(100, 0)">
			<text
				x="0"
				y="47"
				font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif"
				font-size="25"
				font-weight="700"
				fill="currentColor"
				letter-spacing="-0.025em"
			>
				Dependency <tspan fill="#38bdf8">Domino</tspan>
			</text>
			<text
				x="0"
				y="68"
				font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif"
				font-size="10.5"
				font-weight="600"
				fill="#94a3b8"
				letter-spacing="0.1em"
			>
				SUPPLY CHAIN IMPACT ANALYSIS
			</text>
		</g>
	</svg>
{:else}
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 128 128"
		fill="none"
		class={className}
		role="img"
		aria-label={title}
	>
		<defs>
			<linearGradient id="bl-mark-grad1" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color="#1e293b" />
				<stop offset="100%" stop-color="#090d16" />
			</linearGradient>
			<linearGradient id="bl-mark-grad2" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color="#334155" />
				<stop offset="100%" stop-color="#1e293b" />
			</linearGradient>
			<linearGradient id="bl-mark-alert" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color="#fb7185" />
				<stop offset="100%" stop-color="#e11d48" />
			</linearGradient>
			<linearGradient id="bl-mark-sky" x1="0%" y1="0%" x2="100%" y2="100%">
				<stop offset="0%" stop-color="#38bdf8" />
				<stop offset="100%" stop-color="#0284c7" />
			</linearGradient>
			<filter id="bl-mark-glow" x="-30%" y="-30%" width="160%" height="160%">
				<feGaussianBlur stdDeviation="3" result="blur" />
				<feComposite in="SourceGraphic" in2="blur" operator="over" />
			</filter>
		</defs>

		<!-- Domino 2 (Tumbling downstream at 24 degrees) -->
		<g transform="translate(80, 68) rotate(24)">
			<rect
				x="-16"
				y="-33"
				width="32"
				height="66"
				rx="7"
				fill="url(#bl-mark-grad2)"
				stroke="#475569"
				stroke-width="1.8"
			/>
			<line x1="-11" y1="0" x2="11" y2="0" stroke="#475569" stroke-width="1.8" stroke-linecap="round" />
			<!-- Top node receiving cascade -->
			<circle cx="0" cy="-16" r="4.8" fill="#f59e0b" />
			<!-- Branching tree edges -->
			<line x1="0" y1="11" x2="-7" y2="21" stroke="#475569" stroke-width="1.5" />
			<line x1="0" y1="11" x2="7" y2="21" stroke="#475569" stroke-width="1.5" />
			<circle cx="0" cy="11" r="3.4" fill="url(#bl-mark-sky)" />
			<circle cx="-7" cy="21" r="3.4" fill="url(#bl-mark-sky)" />
			<circle cx="7" cy="21" r="3.4" fill="url(#bl-mark-sky)" />
		</g>

		<!-- Cascade impact arc connecting Domino 1 to Domino 2 -->
		<path d="M48 42 C 58 36, 70 42, 80 50" stroke="#f43f5e" stroke-width="2" stroke-dasharray="3 2.5" opacity="0.85" />

		<!-- Domino 1 (Lead domino tipped at -14 degrees) -->
		<g transform="translate(46, 62) rotate(-14)">
			<!-- Drop shadow -->
			<rect x="-19" y="-38" width="38" height="76" rx="8" fill="#000000" opacity="0.4" transform="translate(2, 3)" />
			<!-- Main chassis -->
			<rect
				x="-19"
				y="-38"
				width="38"
				height="76"
				rx="8"
				fill="url(#bl-mark-grad1)"
				stroke="#64748b"
				stroke-width="2.2"
			/>
			<!-- Center groove -->
			<line x1="-13" y1="0" x2="13" y2="0" stroke="#475569" stroke-width="2" stroke-linecap="round" />

			<!-- Graph edges -->
			<line x1="0" y1="-19" x2="-9" y2="19" stroke="#64748b" stroke-width="1.8" />
			<line x1="0" y1="-19" x2="9" y2="19" stroke="#64748b" stroke-width="1.8" />
			<line x1="-9" y1="19" x2="9" y2="19" stroke="#334155" stroke-width="1.2" />

			<!-- Compromised origin node with blast aura -->
			<circle cx="0" cy="-19" r="10" fill="#f43f5e" opacity="0.25" filter="url(#bl-mark-glow)" />
			<circle cx="0" cy="-19" r="6" fill="url(#bl-mark-alert)" />
			<circle cx="0" cy="-19" r="2.2" fill="#ffffff" opacity="0.9" />

			<!-- Dependent downstream nodes -->
			<circle cx="-9" cy="19" r="4.8" fill="url(#bl-mark-sky)" />
			<circle cx="9" cy="19" r="4.8" fill="url(#bl-mark-sky)" />
		</g>
	</svg>
{/if}
