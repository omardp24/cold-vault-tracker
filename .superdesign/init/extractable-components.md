# Extractable components

## Layout Components

## Sidebar
- Source: `src/components/ColdVault.tsx` (lines 948-991, plus `SidebarNavBtn` 916-932)
- Category: layout
- Description: Desktop left sidebar — logo tile, nav items, "Red ahora" gas-fee card
- Extractable props: activeItem (string, default: "portfolio"), pendingCount (number, default: 0), showUsers (boolean, default: true)
- Hardcoded: shield logo SVG, labels (Portafolio, Movimientos, Auditoría, Usuarios), lucide icons, gas values, all CSS

## TopBar
- Source: `src/components/ColdVault.tsx` (lines 996-1027 desktop, 1030-1050 mobile)
- Category: layout
- Description: Sticky top bar — global search, push bell, theme toggle, refresh button, user chip, logout
- Extractable props: none that vary per page
- Hardcoded: everything

## BottomTabBar
- Source: `src/components/ColdVault.tsx` (lines 1142-1154), CSS `.cv-tabbar` in `src/app/globals.css`
- Category: layout
- Description: Mobile fixed bottom navigation
- Extractable props: activeItem (string, default: "portfolio"), showUsers (boolean, default: true)
- Hardcoded: labels, icons, CSS

## Basic Components
- ChainBadge / AssetIcon (`src/components/coldvault/shared.tsx`) — basic — coin logo circle; inline in drafts
- Buttons `.cv-btn` / `.cv-btn-ghost`, inputs `.cv-input` / `.cv-select`, card `.cv-card`, delta pill `.cv-delta` (`src/app/globals.css`) — basic — inline in drafts
