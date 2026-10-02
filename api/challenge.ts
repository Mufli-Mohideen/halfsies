/**
 * Serves /c/<code> (via the rewrite in vercel.json) as the normal app shell,
 * but with link-preview tags personalised for the challenge, so WhatsApp,
 * iMessage, Discord and X unfurl it as "Sam challenged you".
 *
 * The game itself never depends on this: on any failure we redirect to /?c=<code>,
 * which the client understands too.
 */
import { decodeChallenge, sanitiseName, type ChallengeData } from '../src/lib/challengeCodec';

export const config = { runtime: 'edge' };

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function previewCopy(data: ChallengeData): { title: string; description: string } {
  // Names are sanitised by the codec; escaping below is the second line of defence.
  const who = sanitiseName(data.name) || 'A friend';
  if (data.mode === 'daily') {
    return {
      title: `${who} challenged you · Halfsies #${data.seed}`,
      description: `${who} scored ${data.score}/500 cutting five shapes in half. Same shapes, your turn.`,
    };
  }
  return {
    title: `${who} survived ${data.score} ${data.score === 1 ? 'cut' : 'cuts'} · Halfsies`,
    description: 'One straight cut per shape. One lopsided cut and you’re out. Can you last longer?',
  };
}

function setMeta(html: string, attr: 'property' | 'name', key: string, value: string): string {
  const re = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`);
  return html.replace(re, `$1${escapeHtml(value)}$2`);
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') ?? '';
  const fallback = Response.redirect(new URL(`/?c=${encodeURIComponent(code)}`, url.origin).toString(), 302);

  const data = decodeChallenge(code);
  if (!data) return fallback;

  let html: string;
  try {
    const shell = await fetch(new URL('/', url.origin), { headers: { accept: 'text/html' } });
    if (!shell.ok) return fallback;
    html = await shell.text();
  } catch {
    return fallback;
  }

  const { title, description } = previewCopy(data);
  const pageUrl = `${url.origin}/c/${code}`;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = setMeta(html, 'name', 'description', description);
  html = setMeta(html, 'property', 'og:title', title);
  html = setMeta(html, 'property', 'og:description', description);
  html = setMeta(html, 'property', 'og:url', pageUrl);
  html = setMeta(html, 'name', 'twitter:title', title);
  html = setMeta(html, 'name', 'twitter:description', description);
  // Challenge pages are personal; keep them out of search results.
  html = html.replace('</head>', '    <meta name="robots" content="noindex" />\n  </head>');

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Codes are immutable, but the shell changes on deploy; keep the edge cache short.
      'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
