# Ralph Loop: Production-Ready Injasraj (Clean Frontend & Serverless Reliability)

## Objective
Take the Injasraj project to complete production readiness with clean, robust, basic production-grade frontend UI/UX, strict "Injasraj" naming and branding throughout, zero runtime bugs, and hardened serverless reliability on Vercel + Supabase.

## Core Rules & Constraints
1. **Naming & Identity**: The platform must strictly and solely be branded as **"Injasraj"**. No secondary subtitles, suffixes, or marketing slogans like "International 1:1 Video Classroom", "Tutor Workspace", or similar phrases in the window title, metadata, header, or UI. The title must simply be `Injasraj`.
2. **Frontend Philosophy**: "Basic production-grade" — clean, functional, responsive, and uncluttered. No unnecessary visual bloat, animation overhead, or fragile layout tricks. Clean dark mode (`bg-zinc-950`), solid accessibility, and zero z-index or layout jumping.
3. **Infrastructure**: Strictly Vercel Serverless + Supabase (PostgreSQL, Realtime, Storage) + LiveKit. Zero VPS requirement.
4. **Mechanical Verification**: Every cycle must pass `npm test -- --run` and `npm run build`. Never commit on red.
