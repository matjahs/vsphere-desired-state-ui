# vSphere Desired State UI

Next.js + **Material UI** app for comparing and rectifying vSphere Desired State exports across 2–4 ESX hosts.

## Features

- **Import / export** Desired State JSON (vCenter-compatible)
- **MUI X DataGrid** compare matrix with quick filter, sort, pagination, and row coloring (drift / host-local / match / missing)
- **Rectify tools**: copy from host, apply to all, promote to profile, majority vote, prune redundant overrides, make override / make host-specific
- **Profile / host / JSON editors** with AJV schema validation on export

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Sample** to load the included export, select 2–4 hosts, and review drift.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (merge/diff/rectify) |
| `npm run lint` | ESLint |

## Stack

- Next.js App Router, TypeScript, Zustand
- Material UI (`@mui/material`, `@mui/icons-material`)
- MUI X Data Grid (`@mui/x-data-grid`) for compare + host detail tables
- AJV against the shipped Desired State schema

## Data files

- Sample export: `export-settings-1784547718044.json` (also at `public/samples/desired-state-sample.json`)
- Schema: `schemas/desired-state-schema.json` (served from `public/schemas/` for browser validation)
