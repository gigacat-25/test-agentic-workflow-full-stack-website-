# Project State

## Current Phase
Milestone 1: MVP (Phase 1 of 6)
Currently in: Planning

## Completed Work
- None (greenfield project)

## Active Decisions
- **Monorepo**: root package.json with workspace structure for worker/ and frontend/
- **Frontend**: Vite + React + TypeScript SPA (two separate apps: public-site, staff-dashboard)
- **Backend**: Cloudflare Workers with itty-router (lightweight router)
- **Database**: Cloudflare D1 with manual SQL migrations
- **Auth**: Simple JWT-based for staff dashboard (hs256 with secret)
- **Styling**: Vanilla CSS with CSS custom properties (no Tailwind, no heavy framework)
- **WhatsApp**: Abstract behind `WhatsAppProvider` interface (can swap Twilio ↔ Meta API)
- **Email**: Abstract behind `EmailProvider` interface (can swap SendGrid ↔ Resend)

## Decisions Deferred
- Full Cloudflare Workflows implementation (Phase 2)
- R2 image upload UI (Phase 2)
- Phone call automation (Future milestone)
- AI sentiment analysis (Future milestone)
- Multi-doctor scheduling (Future milestone)
- Social login / Cloudflare Access auth (Future)

## Blockers
- None

## Next Actions
1. Create project structure and foundational config files
2. Write D1 migration SQL
3. Implement core TypeScript types
4. Build Worker entry point and router

---

*Last updated: 2026-06-02*
