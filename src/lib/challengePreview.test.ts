import { afterEach, describe, expect, it, vi } from 'vitest';
import handler from '../../api/challenge';
import { encodeChallenge } from './challengeCodec';

const SHELL = `<!doctype html><html><head>
<title>Halfsies — cut it exactly in half</title>
<meta name="description" content="default" />
<meta property="og:url" content="https://halfsies.app/" />
<meta property="og:title" content="default" />
<meta property="og:description" content="default" />
<meta name="twitter:title" content="default" />
<meta name="twitter:description" content="default" />
</head><body></body></html>`;

const code = (name: string) =>
  encodeChallenge({ mode: 'daily', seed: 12, sharerId: 1, score: 431, name, cuts: [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]] });

describe('challenge link previews', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('personalises the unfurl', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(SHELL, { status: 200 })));
    const res = await handler(new Request(`https://halfsies.app/api/challenge?code=${code('Sam')}`));
    const html = await res.text();
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('<meta property="og:title" content="Sam challenged you · Halfsies #12"');
    expect(html).toContain('431/500');
    expect(html).toContain('noindex');
  });

  it('never lets a hand-crafted payload inject markup', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(SHELL, { status: 200 })));
    // Build a payload by hand, bypassing the encoder's sanitising.
    const name = new TextEncoder().encode('"><img src=x>');
    const bytes = [1, 0, 0, 0, 0, 12, 0, 0, 0, 1, 1, 175, name.length, ...name, 5, ...Array(20).fill(1)];
    const raw = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const html = await (await handler(new Request(`https://halfsies.app/api/challenge?code=${raw}`))).text();
    expect(html).not.toContain('<img');
    expect(html).not.toContain('">');
    expect(html).toContain('img srcx challenged you');
  });

  it('redirects to the query-string fallback when the code is bad or the shell is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })));
    const bad = await handler(new Request('https://halfsies.app/api/challenge?code=zzz'));
    expect(bad.status).toBe(302);
    const locked = await handler(new Request(`https://halfsies.app/api/challenge?code=${code('Sam')}`));
    expect(locked.status).toBe(302);
    expect(locked.headers.get('location')).toContain('/?c=');
  });
});
