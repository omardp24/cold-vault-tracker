# Pages — dependency trees

## / → Portafolio tab (main screen)
Entry: src/app/(app)/page.tsx
Dependencies:
- src/components/ColdVault.tsx (app shell; render section lines 907-1157)
  - src/components/coldvault/PortfolioView.tsx
    - src/components/coldvault/EvolutionChart.tsx
    - src/components/coldvault/shared.tsx
      - src/lib/assets.ts
      - src/lib/format.ts
  - src/components/coldvault/GlobalSearch.tsx
  - src/components/coldvault/PushBell.tsx
  - src/components/coldvault/AssistantPanel.tsx
  - src/components/coldvault/shared.tsx
- src/app/layout.tsx
- src/app/globals.css
- tailwind.config.ts

## / → Movimientos tab
Entry: src/components/coldvault/MovementsView.tsx (1102 lines — line-range the render)
Dependencies:
- src/components/ColdVault.tsx (shell, 907-1157)
- src/components/coldvault/TransactionDetailModal.tsx
- src/components/coldvault/ConceptoInput.tsx
- src/components/coldvault/shared.tsx
- src/lib/statementAggregation.ts, src/lib/suspicious.ts (logic only)

## / → Auditoría tab
Entry: src/components/coldvault/AuditTab.tsx
Dependencies:
- src/components/ColdVault.tsx (shell, 907-1157)
- src/components/coldvault/shared.tsx

## / → Usuarios tab (owner only)
Entry: src/components/coldvault/UsersTab.tsx
Dependencies:
- src/components/ColdVault.tsx (shell, 907-1157)
- src/components/coldvault/shared.tsx

## /login, /signup
Entry: src/app/login/page.tsx, src/app/signup/page.tsx
Dependencies:
- src/components/AuthShell.tsx
- src/app/globals.css
