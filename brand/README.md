# Brand sources

Static HTML sources for the exported brand images in `public/`. They use the same
self-hosted fonts as the game, so exports always match the product.

| Source | Export | Size |
| --- | --- | --- |
| `og.html` | `public/og.png` | 1200 × 630 |
| `icon.html` | `public/icon-512.png` (scale down for 192, 180, 32) | 512 × 512 |

Re-export with any Chromium browser, e.g.:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars \
  --allow-file-access-from-files --window-size=1200,630 --screenshot=public/og.png "file://$PWD/brand/og.html"
```

## Identity rules

- **Wordmark:** lowercase `halfsies`, Plus Jakarta Sans 800, tracking −0.05em. The word is cut
  between "half" and "sies"; "sies" is vermilion and drops slightly along the cut.
- **Mark:** a paper disc cut on the same slant, cream left, vermilion right, on the mat green.
- **Colours:** mat `#1d473c`, paper `#f4eedf`, vermilion `#ff5a36`, ink `#121a17`. Nothing else.
- **Studio credit:** "A game by NVYLO", set small. NVYLO never appears larger than the game.
