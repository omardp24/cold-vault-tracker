# Cold Vault Tracker — Design System

## Product context
Personal treasury tool for Comercializadora Agrícola Domínguez, C.A. (CAD Venezuela). Tracks read-only public addresses of Ledger cold wallets on Bitcoin, Ethereum and Tron; classifies movements by partner ("aliado") and concept; audits counterparties; produces account statements. UI language: **Spanish (Venezuela)**. Users: the owner and a few team members — finance people, not crypto traders. Tone: sober, trustworthy, institutional; a treasury ledger, not a trading app.

## Architecture
Single authenticated app with 4 sections: Portafolio (main), Movimientos, Auditoría, Usuarios (owner only). Desktop: left sidebar + sticky top bar. Mobile first: compact top bar + fixed bottom tab bar, bottom sheets for forms/filters, collapsible blocks. Floating AI assistant button bottom-right.

## Brand (hard constraints)
- Petroleum blue #012D37 (basis of the dark surfaces), orange #F77B1C (primary accent/actions), amber #F8B345 (secondary, gradients with orange), green #008747 (positive / Tron).
- Both dark (default) and light modes must work; use ONLY these tokens:

| Token | Dark | Light |
|---|---|---|
| --bg | #071a20 | #f2f5f6 |
| --panel | #0c242c | #ffffff |
| --panel2 | #102e38 | #f6f9fa |
| --line | #17414d | #dce5e8 |
| --ink | #eaf2f4 | #0e2830 |
| --dim | #8fa9b1 | #6b8087 |
| --faint | #5f7f89 | #9badb3 |
| --accent | #f77b1c | #e06a0c |
| --amber | #f8b345 | #c98a18 |
| --pos | #3ed598 | #00794a |
| --neg | #ff6b5a | #c0392b |
| --tint | rgba(247,123,28,.13) | #fdf0e4 |

- Category palette for charts: #F77B1C #008747 #2E6B8C #82C35A #F8B345 #B23A3A #E6E150.
- Fonts: **Sora** for all text/headings; **IBM Plex Mono** for every number, amount, percentage and address. No other fonts.
- Shapes: cards radius 14px with 1px `--line` border and very soft shadow; pill buttons and chips; inputs radius 10px; inset blocks radius 12px on `--panel2`.
- Buttons: primary = solid orange pill, white text; ghost = transparent pill with 1px border, turns orange on hover.
- Logo: rounded tile with orange→amber gradient containing a shield outline; wordmark "Cold Vault".
- Icons: lucide (outline, stroke 2). Coin logos as round images.
- No purple, no neon, no glassmorphism in the app, no emoji.

## Motion
Subtle: 0.3s fade/slide-in on tab change, 70ms staggered cards, shimmer skeletons, animated number counter, pulsing "live" dot. Respect prefers-reduced-motion.

## Requirements
- Mobile first (390px) then desktop. Touch targets ≥ 40px. Nothing overflows horizontally; long amounts and addresses must not wrap awkwardly.
- Read-only security messaging: only public addresses, never private keys.
- Amounts in USD with VES equivalents (BCV and paralelo rates). Times in Caracas time.
