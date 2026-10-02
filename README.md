# Halfsies

**Can you cut it exactly in half?** One swipe per shape, five shapes a day, closest to 50/50 wins.
Then send the link: your friend cuts the *same* shapes and sees your cut laid over theirs.

A game by [NVYLO](https://www.nvylo.com).

- [DESIGN.md](DESIGN.md): concept, viral loop, retention, marketing
- [LAUNCH.md](LAUNCH.md): product review, trust model, metrics, launch checklist
- [brand/](brand/): identity rules and sources for the OG image and icons

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173 (React, fast refresh)
npm test           # geometry, shapes, scoring, codec, storage, link-preview function
npm run build      # type-check + production build (Preact runtime) into dist/
npm run preview    # serve dist/ with the production security headers
```

Node 20+.

## Deploy to Vercel

1. Import the repo at vercel.com/new. The **Vite** preset is detected; keep the defaults.
2. Set `VITE_SITE_URL` to the production URL (canonical + OG tags).
3. Deploy. `vercel.json` already provides:
   - `/c/:code` → `api/challenge.ts` (edge function) for personalised link previews;
   - `/sudden-death` → the app shell (linkable mode);
   - CSP and security headers on every response, immutable caching for `/assets` and `/fonts`.

If the edge function can't fetch the shell (e.g. a password-protected preview), it redirects to
`/?c=<code>`, which the client also understands. Challenge links never break.

## Stack

| | |
|---|---|
| UI | React components; production ships **Preact via `preact/compat`** (28 KB gzipped JS instead of 86 KB). Delete the `alias` block in `vite.config.ts` to ship React. |
| Rendering | Canvas 2D for the board, thumbnails and the share card |
| Sound | Web Audio, synthesised (no audio files) |
| Fonts | Plus Jakarta Sans (variable, 27 KB) and JetBrains Mono 500 (22 KB), self-hosted, Latin subset |
| State | `localStorage`, versioned and validated, synced across tabs |
| Server | One optional edge function (link previews). No database. |
| Tests | Vitest |

Runtime dependencies: `react`, `react-dom` (dev), `preact` (production).

## Project structure

```
api/challenge.ts          Edge function: personalised unfurls for /c/<code>
brand/                    OG and icon sources + identity rules
public/                   fonts, favicon, icons, og.png, manifest, robots.txt
src/
  App.tsx                 Routing, persistence, cross-tab follow, finish/retry
  main.tsx                Entry
  styles.css              Design tokens + every style in the product
  state/
    routes.ts             URLs → screens (/, /sudden-death, /c/<code>), history
    useSave.ts            Save file: write-through, cross-tab sync, failure flag
  game/                   Pure logic (no DOM)
    geometry.ts           Area, half-plane clipping, lines, quantisation
    shapes.ts             12 procedural shape families; daily & sudden-death sequences
    scoring.ts            Points, grades, tones, ranks, tolerance
    run.ts                Runs, totals, head-to-head
    rng.ts                Seeded PRNG
  lib/
    challengeCodec.ts     Challenge payload ⇄ base64url (shared with the edge function)
    share.ts              Message, channels, native share, clipboard, image
    storage.ts            Save schema, validation, stats
    analytics.ts          Optional, privacy-respecting events
    sound.ts · daily.ts · motion.ts
  render/
    draw.ts               Shared canvas drawing + palette
    resultCard.ts         1080×1350 share image
  components/
    Board.tsx             Cutting board: pointer + keyboard input, render loop, feedback
    PlayScreen.tsx        A run: rounds, reveal, auto-advance, retry
    RoundHeadline.tsx     Instruction / result headline (fixed height)
    ResultScreen.tsx      Score or head-to-head, share entry point, what's next
    ShareSheet.tsx        Name, message preview, native/WhatsApp/X/Facebook/copy/image
    Sheet.tsx             Accessible sheet (focus trap, Escape, focus return)
    StatsSheet.tsx · ShapeThumb.tsx · Header.tsx · Wordmark.tsx · StudioCredit.tsx
    Toast.tsx · ErrorBoundary.tsx · useCountUp.ts
```

## How it works

- **Same shapes for everyone.** Shapes come from `daily:<day>:<round>` seeds; the day is the
  player's local date (#1 = 1 Oct 2026). Generators are **frozen after launch** (see `shapes.ts`).
- **Exact scoring.** A cut is an infinite line; area on each side via half-plane clipping, exact
  for concave shapes. Judged at the precision shown (0.1%), so equal-looking cuts tie.
- **Challenges without a server.** The link carries mode, seed, name and every cut (4 bytes each).
  The receiver regenerates the shapes and re-scores the cuts locally.
- **Integrity.** Today's cuts are saved as they happen, so a reload can't re-roll a bad cut, and a
  second tab follows the first instead of overwriting it.

## Analytics

Off unless `VITE_ANALYTICS_ENDPOINT` is set or a Plausible script is added. Never sent when the
browser signals Global Privacy Control or Do Not Track. No names, no cuts, no fingerprinting. Each
event carries `pid` (random device id), `age` (days since first visit), `day`, `ref` (sharer's id
on challenge visits) and `sid`.

| Event | Props |
|---|---|
| `game_loaded` | `returning`, `route` |
| `game_started` | `mode`, `challenge`, `resumed` |
| `round_cut` | `mode`, `round`, `kind`, `deviation` |
| `game_completed` | `mode`, `score`, `rounds`, `challenge` |
| `game_retried` | `mode`, `from` (play / result) |
| `new_high_score` | `mode`, `score` |
| `share_clicked` | `mode`, `rematch` |
| `share_completed` | `channel` (native/whatsapp/x/facebook/copy/image), `outcome`, `mode` |
| `challenge_created` | `channel`, `mode` |
| `challenge_opened` | `mode`, `from` |
| `challenge_completed` | `mode`, `outcome`, `from` |
| `challenge_invalid` | – |
| `session_end` | `seconds` |

Metric definitions are in [LAUNCH.md](LAUNCH.md#metrics).
