// GET /api/price

import { sendError, sendJson } from './_lib/http.js';

const UPSTREAM = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  let upstream;
  try {
    upstream = await fetch(UPSTREAM, {
      signal: AbortSignal.timeout(6000),
      headers: { 
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
    });
  } catch (err) {
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      return sendError(res, 504, 'TIMEOUT');
    }
    return sendError(res, 502, 'NETWORK_ERROR');
  }

  if (upstream.status === 429) {
    return sendError(res, 429, 'RATE_LIMIT');
  }
  if (!upstream.ok) {
    return sendError(res, 502, 'UPSTREAM_ERROR');
  }

  let body;
  try {
    body = await upstream.json();
  } catch {
    return sendError(res, 502, 'UPSTREAM_ERROR');
  }

  const usd =
    body && body.ethereum && typeof body.ethereum.usd === 'number'
      ? body.ethereum.usd
      : null;

  if (usd === null) {
    return sendError(res, 502, 'UPSTREAM_ERROR');
  }

  res.setHeader(
    'Cache-Control',
    'public, s-maxage=60, stale-while-revalidate=300'
  );

  return sendJson(res, 200, { ok: true, eth_usd: usd });
}