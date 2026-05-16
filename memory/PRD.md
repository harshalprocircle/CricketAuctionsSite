# Slam Auction — Sports Tournament Auction Platform

## Problem Statement
Build a full-stack web app for an IPL/fantasy-league-style live player auction. Every team owner starts with the same configurable budget (default 10,000 points). Players go on the block one at a time; the winning owner's points are deducted in real-time; player is linked to the owner. Validations: bid ≥ base price, ≤ owner remaining, no double-sell. Photos for owners and players are entered as Google Drive shareable links and auto-converted into direct-image URLs. Pages: Live Auction Room, Owners Management, Players Roster (filter Unsold/Sold/Current), Auction History (with rollback). CSV bulk import for owners and players. Real-time multi-viewer sync via 2.5s polling. No auth.

## Architecture
- **Frontend**: React 19 + React Router 7 + Tailwind + shadcn/ui + lucide-react. Polling-based realtime (2.5s on Dashboard). Bebas Neue display font + Manrope body. Dark IPL-broadcast aesthetic (#0A0A0A base, #EAB308 gold, #22C55E green accents).
- **Backend**: FastAPI + Motor (async MongoDB). All routes prefixed `/api`. Owner remaining/spent computed via aggregation pipeline on every list.
- **DB Collections**: `settings` (singleton), `owners`, `players`, `transactions`. UUID string `id` fields; `_id` excluded from all responses.

## Completed (2026-02)
- [x] Database schema with Owner / Player / Transaction Pydantic models
- [x] Settings endpoint (configurable starting budget + tournament name)
- [x] Owners CRUD with derived `starting_budget`, `spent`, `remaining`, `players_count`
- [x] Players CRUD with status state machine (unsold → current → sold)
- [x] `set-current` action (auto-demotes any prior current player)
- [x] `sell` action with full validation (price ≥ base, ≤ remaining, no double-sell)
- [x] Transaction rollback (release player + refund owner)
- [x] Auction reset endpoint
- [x] CSV bulk import for owners & players
- [x] Google Drive URL converter (`/file/d/{ID}`, `?id={ID}`, `/d/{ID}` → `drive.google.com/thumbnail?id=...`)
- [x] Dashboard / Live Auction Room (hero card + leaderboard + up-next strip)
- [x] Owners Management page (cards with roster, budget bar, photo)
- [x] Players Roster page (grid + tabs filter + search)
- [x] Auction History page (table + rollback)
- [x] Settings dialog (edit budget + tournament name)
- [x] 2.5s polling on Dashboard
- [x] Backend test suite (8/8 passing) + frontend E2E smoke (100%)

## Core Requirements (Static)
- Real-time auction tracking across owners
- Budget never goes negative
- Player can only be sold once
- Image URL conversion is automatic & resilient (fallback on error)
- All interactive elements carry `data-testid`

## Backlog (Future)
- **P1**: Animated point-ticker on sell; sound effect on hammer; AlertDialog instead of window.confirm
- **P1**: Export auction history to CSV/PDF
- **P2**: WebSocket upgrade (replace polling) for sub-second sync
- **P2**: Role-based caps (max N batsmen per team), Min-N-Bowlers rule
- **P2**: Owner-side bidding view with claim button (multi-user live bidding)
- **P2**: Player rating / overseas tagging
- **P2**: Auction streaming overlay (OBS-friendly transparent view)

## Next Tasks
- Gather user feedback on hero layout & color accents
- Add CSV export from History page for post-auction archiving
- Optionally add a single $lookup aggregation for owners list to avoid N+1 aggregation calls
