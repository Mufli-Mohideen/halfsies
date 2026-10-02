# Halfsies: launch review

The question this document answers: **is Halfsies good enough to put the NVYLO name on?**

## 1. Audit of the first build (before this pass)

The loop was strong (one swipe, a precise result, challenge links with ghost cuts). The product around it was not NVYLO-grade yet.

| Area | Problem | Fix |
|---|---|---|
| Typography | Monospace for body copy and buttons, uppercase + 0.1–0.14em tracking almost everywhere: reads as a terminal or template. Display serif digits made count-ups shift width. | One family (Plus Jakarta Sans, NVYLO's display face) with a 6-step scale and 3 weights. Mono only for data labels, as on nvylo.com. Tabular figures everywhere numbers change. |
| Colour | Five grade colours (purple/green/yellow/orange/red) plus brand vermilion. | Three tones: paper (good), dimmed paper (close), vermilion (bad). PERFECT is an inverted paper label. |
| Spacing / shape | Mixed paddings, radii of 10/14/22/99, "3D" button shadows. | 4/8/12/16/24/32/48 scale (sits on the 24px mat grid), radii 6/10/20, flat buttons. |
| Motion | Infinitely wobbling "it spins" pill, 70-piece confetti, a stamp animation, shake on every cut. | No looping decoration. PERFECT = one thin ring + 18 flakes. Shake only on bad cuts. Verdict fades up in 200ms. |
| Layout stability | Headline height changed between aim and reveal, so the board jumped on reveal. | Fixed-height headline. Numbers ordered to match where each piece lands. |
| Retry | Out in Sudden Death → "See result" → result screen → "Try again". | "Try again" on the out screen; survived cuts auto-advance with a visible hairline timer. |
| Navigation | Back button left the site. | Real URLs (`/`, `/sudden-death`, `/c/<code>`) with history. |
| Integrity | Two tabs could overwrite each other; double-tap could finish a run twice. | Cross-tab follow, finish guard. |
| Sharing | One "Challenge" button, copy-to-clipboard only on desktop, name field before sharing was unexplained. | Share sheet: name ("as your friend will see it"), live message preview, native share, WhatsApp, X, Facebook, copy link, image for Stories. |
| Accessibility | Not playable without a pointer. Small vermilion text failed contrast. | Keyboard aiming (arrows, Shift = fine, Enter = cut), focus trap in sheets, contrast fixes, reduced motion respected in canvas too. |
| Brand | Plain italic text wordmark, no studio presence. | Cut wordmark (`half` / `sies`), cut-disc icon, OG and share card in the same system, "A game by NVYLO" on results, stats and share card. |
| Performance | 86 KB gzipped JS, Google Fonts (third-party request, late swap). | 28 KB gzipped JS (Preact via compat), self-hosted preloaded fonts (49 KB total). |
| Security | Names could contain URLs ("claim.prize/now challenged you"). No CSP. | Name allow-list (letters, digits, space, `'-_`), CSP + security headers, escaping kept as second line of defence. |

## 2. The first 10 seconds (fresh visitor from a social link)

| Time | What happens |
|---|---|
| 0–1 s | HTML (1.4 KB) and the mat background paint immediately. JS (28 KB) and the display font (27 KB, preloaded) arrive. Locally the board is interactive in ~80 ms. |
| 1–3 s | They see: `halfsies` · "Cut it exactly in half." · a shape · a red dashed line animating across it. No modal, menu, cookie banner or account. |
| 3–6 s | They swipe. The blade runs edge to edge so the finger never hides it. A tick on touch (and a light vibration on Android). |
| 6–8 s | The pieces spring apart, numbers count to e.g. `53.3 / 46.7` (ordered left-to-right like the pieces), the verdict lands: "Lopsided +67". |
| 8–10 s | "Next shape →". The second shape shows "67 points so far". The stakes are already there. |

From a challenge link the headline is "Sam challenged you · Beat 431/500 on the same shapes" and every reveal shows Sam's cut as a dashed line plus "you take it / they take it".

## 3. "One more try"

- **Play once:** the instruction is the whole game; the result is a precise number about *you*.
- **Again right now:** Sudden Death. Retry is one tap from the out screen, survived cuts flow without taps, "So close. Out by 0.4." on near misses, "New best." when you pass your record.
- **Send it:** the result is a challenge with proof (emoji row, ghost cuts), and the reply is pre-written for the outcome ("I beat Sam, 447 to 431. Your move.").
- **Come back tomorrow:** five new shapes at local midnight, streak, personal best on the result.
- **Ten times:** genuine skill growth (concave shapes, centroids outside the shape, spinning finales). Nothing to grind.

Deliberately **not** added: XP, coins, badges, levels, global leaderboard (cheatable without a server and
meaningless next to beating a named friend).

## 4. Trust model (no backend)

Everything runs on the player's device. Concretely:

| Value | Trusted? | Why |
|---|---|---|
| Shapes | Yes | Regenerated from the seed by every client. |
| A friend's score in a challenge | Recomputed | The receiver re-scores the friend's cuts on regenerated shapes. The score inside the link is used only for preview text. |
| A friend's cuts | **No** | A determined person can hand-craft perfect cuts and send a 500/500 link. Harmless today (no shared leaderboard), but **any future server leaderboard must not accept client-submitted scores or cuts as proof.** |
| Names in links | Sanitised | Allow-list on encode and decode; HTML-escaped again in the edge function; rendered as text by React. |
| Local saves | Validated | Every field is type-checked on load; corrupt data falls back field by field. |
| Query/path params | Only `c` / `/c/<code>` | Strict base64url, length-capped, versioned binary format; anything else → "broken link" toast and today's puzzle. |

Headers (from `vercel.json`, mirrored in `vite preview`): CSP (`script-src 'self'`, no inline scripts, `frame-ancestors 'none'`), `nosniff`, `strict-origin-when-cross-origin`, `Permissions-Policy`, COOP.

## 5. Domain

Do not assume availability. In order of preference:

1. **halfsies.com.** The name is the instruction, so the bare .com is unbeatable for word of mouth ("just go to halfsies dot com"). Worth paying a premium for.
2. **halfsies.game.** Short, honest, memorable; the TLD says what it is. Best fallback.
3. **playhalfsies.com.** Safe .com, but the extra word is friction when spoken aloud.

Avoid domain hacks (`halfsi.es`): hard to say, easy to mistype. Redirect `nvylo.com/halfsies` to the
chosen domain so the studio site links to it, and keep the game's own domain as canonical.

## 6. Metrics

Event names and props are in the README. What matters, in order:

1. **K-factor:** shares per completer × opens per share × completions per open. Join `challenge_created`
   (by `pid`) to `challenge_opened`/`challenge_completed` (by `from`). **Above 0.5 = spreading with help;
   above 1 = spreading on its own.** This is the number that says whether the loop works.
2. **Challenge completion rate:** `challenge_completed / challenge_opened`. Low means the landing or the first shape loses people.
3. **Rematch rate:** `share_clicked` with `rematch: true` / challenge completions. The ping-pong that drives K.
4. **Day-1 and Day-7 retention:** distinct `pid` with `game_loaded` at `age` 1 / 7 over first-day players.
5. **First-cut rate:** players with a `round_cut` / `game_loaded`. Should be > 85%, or the first 5 seconds are failing.
6. **Daily completion rate** and **drop-off by `round_cut.round`**.
7. **Retry rate:** `game_retried` per Sudden Death run; games per user per day.
8. **Session duration** (`session_end.seconds`), **DAU**, game starts.
9. **Difficulty health:** `round_cut.deviation` per shape `kind`; daily score distribution.

Vanity metrics (raw visits, total shares) don't say whether it's spreading. K and Day-1 retention do.

## 7. Monetization

**Not at launch.** The first weeks are for proving the loop; ads would cost exactly the
metrics above. When there's an audience, in this order:

1. **Sponsored shapes:** a brand's silhouette as one of the day's five ("cut the pizza fairly"). Native and shareable, and it never interrupts.
2. **Supporter pack** (one-time): mat colourways, an archive of past dailies. Cosmetic only.
3. **Themed weeks / packs:** holidays, country outlines, thirds and quarters modes.
4. **Classroom licence:** fractions and area intuition.
5. If ever: one banner on the Sudden Death result after several retries. Never on the daily, never on a challenge landing.

## 8. Remaining risks

- **Real devices not yet tested.** QA ran on headless Chrome with touch emulation at 320–1920px, landscape included. Before launch, test on a real iPhone (Safari) and a mid-range Android (Chrome), especially: iOS edge-swipe-back on the board, haptics, the native share sheet with an image, and the in-app browsers of Instagram and TikTok (clipboard and `navigator.share` behave differently there).
- **Shape generators are frozen on launch day.** Changing them rewrites every past puzzle and link.
- **Forged challenge links** are possible (see trust model). Acceptable without a leaderboard.
- **Timezones:** the daily changes at each player's local midnight, so a friend ahead in time can share tomorrow's shapes. Same trade-off as Wordle.
- **No offline mode:** after the first load it plays without network, but there's no service worker.
- **Dynamic OG images** are static; previews personalise title and description only.

## 9. Launch checklist

**Before launch**
- [ ] Buy the domain (section 5), set `VITE_SITE_URL`, deploy to Vercel, add the domain
- [ ] Open a challenge link in WhatsApp, iMessage, Discord, X, Slack: preview says "<name> challenged you"
- [ ] Validate OG with the Facebook Sharing Debugger and the X card validator
- [ ] Real-device pass: iPhone Safari, Android Chrome, Instagram in-app browser, TikTok in-app browser
- [ ] Turn on analytics (Plausible or an endpoint) and confirm events arrive
- [ ] Freeze `shapes.ts` (tag the commit)
- [ ] Link from nvylo.com (Products / Lab)

**Verified in this pass**
- [x] Fresh user understands it: instruction + animated hint, no onboarding
- [x] First interaction obvious; board interactive ≈ 80 ms locally
- [x] Retry instant (Try again on the out screen; auto-advance)
- [x] Mobile 320–430px, tablet, desktop, wide desktop, landscape phone: no overflow
- [x] Typography scale, spacing scale, three tones, two fonts
- [x] NVYLO credit subtle (results, stats, share card, OG)
- [x] Share flow: native / WhatsApp / X / Facebook / copy / image card
- [x] Challenge flow incl. rematch; broken-link fallback
- [x] SEO + OG + Twitter metadata, favicon (SVG + PNG), manifest, JSON-LD publisher
- [x] LocalStorage: corrupt data, blocked storage, two tabs
- [x] Keyboard play, focus trap, reduced motion, contrast
- [x] No console errors or CSP violations in the QA run
- [x] No dead buttons, no placeholder copy
- [x] 28 unit tests pass; production build succeeds
