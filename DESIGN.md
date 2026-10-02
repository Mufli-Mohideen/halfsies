# Halfsies: design notes

> Someone plays once, gets a result, wants another attempt right away, and thinks of a specific person to beat.

## 1. Five concepts considered

| | **A. Halfsies** | **B. Echo** | **C. Unique** | **D. Blind 10** | **E. Fair Pour** |
|---|---|---|---|---|---|
| **Loop** | Swipe once to cut a shape into two exactly equal halves; 5 shapes a day | Shape flashes for 1.5 s; draw it from memory; scored by overlap | Pick the lowest number nobody else picks today; results tomorrow | Stop a stopwatch at exactly 10.00 s, display hidden after 3 s | Tilt and pour a drink into 3 glasses equally, then cut off the stream |
| **Why click** | "Can I cut this in half?" is an instant, universal itch | Funny drawings | Game-theory curiosity | Simple boast | Satisfying physics |
| **Why replay** | Every shape is a new estimation puzzle; 49.6 makes you want 50.0 | Moderate | Once a day only | High for a minute, then shallow | Medium |
| **Session** | 60–90 s daily, endless Sudden Death | 2 min | 10 s | 20 s | 2–3 min |
| **Skill vs luck** | ~100% skill, deep ceiling (PERFECT ≈ 2–4% even for a centroid-exact cut) | Skill, but scoring feels fuzzy | Mostly luck/meta | Skill, shallow ceiling | Skill + physics noise |
| **Social** | Same shapes, your cut drawn over theirs, round-by-round verdict | Side-by-side drawings | Global only | Score compare | Score compare |
| **Shareable artefact** | Split shape + "49.8 / 50.2", emoji row, image card | Bad drawings (strong) | A number | A number | A clip |
| **One more try** | "0.2 from perfect" | Medium | None (wait a day) | Strong but brief | Medium |
| **No account / mobile** | Yes / one-thumb swipe | Yes / finger drawing is imprecise | Needs a backend | Yes / yes | Yes / tilt needs permissions on iOS |
| **Video spread** | Viewers argue over whether a cut is 50/50 before the reveal | Funny fails | Weak visuals | Weak; already done | Good visuals |
| **Monetization** | Sponsored shapes (brand silhouettes), cosmetics, packs | Cosmetics | Sponsorship | Ads | Sponsored drinks |
| **Tech complexity** | Medium (geometry, deterministic generation) | High (shape matching) | Backend + anti-abuse | Trivial | High (fluid sim, perf) |
| **Weakness** | Pure estimation could feel samey | Scoring feels unfair | 24 h feedback loop kills momentum | Done before, thin | Physics jank on low-end phones |

**Chosen: A, Halfsies.** It's the only one that scores high on all of: instant comprehension (the instruction *is* the name), a skill ceiling deep enough for 20+ sessions, a result that's a debate rather than a number, and a challenge mechanic built into play (your cut drawn over theirs) rather than added on. Its weakness, sameness, is handled by 12 shape families escalating to concave, multi-piece and spinning shapes. The simulation (section 9) confirmed the skill spread.

## 2. Viral loop

```
Play daily (60 s) → result "431/500 · Steady hand" + 5 split thumbnails
     → "Challenge a friend" (native share sheet → WhatsApp/iMessage/Discord)
     → link preview: "Sam challenged you · Halfsies #12" — "Sam scored 431/500…"
     → friend lands *on the first shape* with "Sam challenged you", swipes, no menu
     → after every cut: Sam's cut appears as a dashed line + "you take it / they take it"
     → result: "You win. 447 vs 431" → "Send it back" (pre-written trash talk)
     → Sam gets the rematch link → ...
```

Mechanics chosen and why:
- **Same seed for everyone (daily)**: makes results comparable, which makes them worth sending.
- **Challenge links carrying every cut**: the per-shape ghost comparison is the emotional peak ("I was SO close to Sam's"). No server needed.
- **Rematch share text that changes with the outcome**: "I beat Sam: 447 vs 431. Your move." / "Sam got me… Run it back?" A result gives the player something to say.
- **Not used**: global leaderboards (anonymous and cheatable, and nobody you know is on them) and referral rewards (they feel transactional).

## 3. The 5-second test

The homepage is the first shape. The headline reads *"Cut it exactly in half."* and an animated swipe hint plays across the shape until first touch. There's no menu, no modal and no account. Typical time to first cut is under 5 seconds. Challenge links skip even the headline instruction: "Sam challenged you · They scored 431/500 · Swipe to start."

## 4. Retention layers

| Layer | Hook |
|---|---|
| First session | Pieces split apart, numbers count up, verdict lands: an instant, legible result |
| Second attempt | Sudden Death: one tap to restart, tolerance tightens every cut (±5% → ±1%), shapes start spinning from cut 8 |
| Same day | Rematches with friends; trying to beat your Sudden Death best |
| Next day | New 5 shapes at local midnight, countdown on the result screen, streak counter |
| 20+ sessions | Real skill growth (learning area intuition for concave shapes), PERFECT hunting, distribution chart in stats, the spinning finale |

No XP, no unlock grind. Progression comes only from getting better.

## 5. Social design

- **Share message** (native share sheet, WhatsApp, X, copy):
  ```
  Halfsies #12 · 431/500
  🟩🟩🟨🟩🟥
  Beat that.
  https://halfsies.app/c/AQAAAAAB2G6V…
  ```
  After a challenge it adapts: "I beat Sam, 447 to 431. Your move." / "Sam beat me, 402 to 431. Rematch?"
  The squares are data (Wordle-style), not decoration; there are no emoji anywhere else.
- **Share sheet:** name ("as your friend will see it"), live preview of the exact message, Send challenge (native), WhatsApp, X, Facebook, Copy link, Save image for Stories.
- **Image card** (1080×1350): wordmark, score, rank or "Beat Sam, 447 to 431", the five cut shapes with the rival's cuts, "Your turn.", URL, "A game by NVYLO".
- **Link preview** (edge function): `og:title` "Sam challenged you · Halfsies #12", `og:description` "Sam scored 431/500 cutting five shapes in half. Same shapes, your turn."
- **Screenshot-ready without sharing:** the result screen carries the wordmark, puzzle number, score and five cut thumbnails.

## 6. Game feel

Motion is there to communicate, then get out of the way. Every timing below was checked frame by frame.

| Moment | Motion | Why |
|---|---|---|
| Touch down | Blade appears instantly, edge to edge; tick + light vibration | Instant response; the finger never hides the cut |
| Release | Blade flash (340ms), pieces spring apart along the cut (380ms, slight overshoot), ≤16 paper crumbs | The cut *happened* |
| Readout | Starts at **50.0 / 50.0** and drifts to the truth (520ms daily, 360ms Sudden Death), ticks every 0.5 | A needle settling: the distance travelled is the miss; a perfect cut never moves |
| Verdict | Fades up as the readout settles (~570ms after release) | Lands with the sound, not before the numbers |
| Bad cut | 4px shake, 220ms | Felt, not punishing |
| PERFECT | Inverted label, one thin ring expanding from the shape, 12 flakes, three-note chime | Special and precise, not a confetti cannon |
| Next shape | Old pieces clear; new shape fades in while settling from 92% (300ms); headline settles from 35% opacity (160ms) | No blank frame, no bounce |
| Sudden Death | Auto-advance with a hairline timer in the button; out → Try again in one tap | Keeps the rhythm |
| Result | Score counts up (640ms), rank fades in after it; chime waits for the count | A total being added up |
| Share | Copy → button reads "Copied ✓" for 0.9s, then the sheet slides away (200ms, accelerating) | Confirmation where you tapped |

`prefers-reduced-motion` removes particles, shake, count-ups and transitions; the game stays fully playable.

## 7. Visual identity

NVYLO DNA + Halfsies personality. From NVYLO: Plus Jakarta Sans at heavy weights with tight negative tracking, a mono for small data labels, flat buttons with a quiet arrow, calm restraint. Halfsies' own: the self-healing **cutting mat** (green, 24px grid, major line every 5 cells), **paper** shapes lifted off it, one **vermilion** for the other half. The wordmark is the word cut in two: `half` in paper, `sies` in vermilion, dropped along the cut. The icon is a paper disc cut on the same slant. Four colours in total. Rules in [brand/README.md](brand/README.md).

## 8. Monetization (never before the first play, never inside the daily)

1. **Sponsored daily shapes.** The best fit: a brand's silhouette becomes a shape ("Today's #4 is presented by …: cut the pizza fairly"). It's native, memorable and doesn't interrupt play.
2. **Supporter pack ($3 one-time):** mat colourways, blade colours, an archive of past dailies. Cosmetic only.
3. **Premium challenge packs:** themed weeks (holiday silhouettes, famous logos, country outlines), plus "thirds" and "quarters" modes.
4. **Classroom/education licence:** fractions and area intuition. Teachers can share a seed with a class.
5. **Optional ad slot:** at most one non-interstitial banner on the Sudden Death result screen after the 3rd retry. Never on daily, never on challenge landing.

## 9. Difficulty check (simulated)

Over 200 days × 5 rounds × 12 angles:

| Round | "Through the box centre" avg | "Through the exact centroid" avg | PERFECT via exact centroid |
|---|---|---|---|
| 1 | 70 | 85 | 2.6% |
| 2 | 72 | 89 | 3.5% |
| 3 | 68 | 87 | 3.8% |
| 4 | 49 | 77 | 1.9% |
| 5 (spins) | 50 | 79 | 1.8% |

Lazy play lands around 250–320/500; skilled play (judging centroid *and* angle) reaches 450+. Horseshoes (centroid outside the shape) and skylines are the comment-section shapes.

During development the first-round flower had even petal counts, which made it point-symmetric: any cut through the middle was a free PERFECT. Petals, star tips and gear teeth are now odd, so a lazy centre cut scores 53.8/46.2 instead.

## 10. Marketing

- **TikTok / Reels / Shorts:** the format is "pause and guess". Show the cut, freeze before the numbers, let comments argue, then reveal. Shapes are vertical-video friendly, the reveal is under 2 seconds, and the sound design gives an ASMR snick.
- **X:** emoji grids and the daily number (#12) drive "today's spiral was evil" threads, as Wordle's did.
- **Reddit:** r/WebGames, r/InternetIsBeautiful, r/oddlysatisfying (perfect cuts), r/geometry/r/math (the centroid-outside-the-shape horseshoe).
- **Discord:** drop a daily link in a server and everyone's cuts overlay. Easy server ritual.
- **WhatsApp / iMessage:** the personalised preview plus a "Send it back" ping-pong between friends and family groups.

### 10 content ideas
1. "Cut it in half or I lose $10": a creator vs their partner on today's 5 shapes, with ghost-cut reveals.
2. Pause-and-guess: "Is this 50/50? Comment before the reveal." (horseshoe cut through the gap).
3. A perfect 50.0 / 50.0 clip with confetti, slowed down, looped.
4. "Surgeon vs Butcher": a nurse/chef/carpenter tries the daily (profession bait).
5. Twins/siblings settle who gets the bigger slice: "Halfsies decides who's fair."
6. Teacher reveals the trick: "Why the centre of a horseshoe isn't inside it."
7. Sudden Death speedrun: 20 cuts with the spinning shapes.
8. Grandma vs grandson on the same link, side-by-side screens.
9. "Rate my cut" duet chain: each creator stitches with a closer split.
10. Brand collab: "Cut our logo in half." Sponsored-shape behind the scenes.

## 11. Future updates
1. **Thirds and quarters:** two-cut rounds, target percentages ("cut off exactly 30%").
2. **Global percentile:** "You beat 82% of players today." Needs a tiny KV (Vercel KV/Upstash) storing per-day histograms.
3. **Dynamic OG images** with the actual cuts via `@vercel/og`.
4. **Friend leagues:** one group link with a weekly table (needs KV).
5. **Create-a-shape:** draw a polygon, send it as a challenge.
6. **Weekly boss shape:** harder, longer spins, shareable badge.
7. **Archive mode** for past dailies (supporter perk).
8. **Seasonal shape families:** pumpkins, snowflakes, hearts (Valentine's Day halves).
9. **Accessibility cut mode:** tap two points instead of a swipe, plus keyboard aim.
10. **PWA offline + home-screen install prompt** after the third daily.

## 12. Metrics to track
- Visitor → first cut rate (target > 85%) and median time to first cut (target < 6 s)
- Daily completion rate (5/5) and drop-off by round (`round_cut.round`)
- Sudden Death retry rate and runs per session
- Share rate per completed daily and per result type (link vs image vs copy)
- Challenge open → start → complete funnel; rematch rate ("Send it back" shares from challenge results)
- K-factor (see README) and its split by source (WhatsApp/iMessage vs social)
- D1 / D7 / D30 retention (`age` on `visit`), current-streak distribution
- Score distribution per day (is today too hard?) and per shape kind (`round_cut.kind`, `deviation`)
- Session length (`session_end.seconds`)
