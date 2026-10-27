// GET /api/resolve?name=vitalik.eth
//
// Resolves a .eth name to an Ethereum 0x address via GoldRush's
// resolve_address endpoint. Enforces:
//   - .eth-only pattern (lowercase letters, digits, hyphens; must end .eth)
//   - 5-minute cache
//   - Clean error codes matching the rest of the API

import { sendError, sendJson } from './_lib/http.js';

const UPSTREAM = 'https://api.covalenthq.com/v1/eth-mainnet/address';
const ETH_NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.eth$/;

function validateEthName(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'MISSING_NAME' };
  const name = raw.trim().toLowerCase();
  if (name === '') return { ok: false, error: 'MISSING_NAME' };
  if (name.length > 255) return { ok: false, error: 'INVALID_NAME' };
  if (!ETH_NAME_RE.test(name)) return { ok: false, error: 'INVALID_NAME' };
  return { ok: true, name };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  const check = validateEthName(req.query && req.query.name);
  if (!check.ok) {
    return sendError(res, 400, check.error);
  }

  const key = process.env.COVALENT_API_KEY;
  if (!key) {
    return sendError(res, 500, 'MISSING_API_KEY');
  }

  // Path-encode the name. encodeURIComponent handles dots fine in path
  // segments for this endpoint, and it's what GoldRush's docs use.
  const name = check.name;
  const url = `${UPSTREAM}/${encodeURIComponent(name)}/resolve_address/`;

  let upstream;
  try {
    upstream = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Authorization': `Bearer ${key}`,
      },
    });
  } catch (err) {
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      return sendError(res, 504, 'TIMEOUT');
    }
    return sendError(res, 502, 'NETWORK_ERROR');
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return sendError(res, 502, 'KEY_REJECTED');
  }
  if (upstream.status === 429) {
    return sendError(res, 429, 'RATE_LIMIT');
  }
  if (!upstream.ok) {
    return sendError(res, 502, 'RESOLVER_UNAVAILABLE');
  }

  let body;
  try {
    body = await upstream.json();
  } catch {
    return sendError(res, 502, 'RESOLVER_UNAVAILABLE');
  }

  if (body && body.error) {
    return sendError(res, 502, 'RESOLVER_UNAVAILABLE');
  }

  const items = body && body.data && Array.isArray(body.data.items)
    ? body.data.items
    : [];

  const resolved = items.find(
    (item) =>
      item &&
      typeof item.address === 'string' &&
      /^0x[a-fA-F0-9]{40}$/.test(item.address)
  );

  if (!resolved) {
    return sendError(res, 404, 'NAME_NOT_FOUND');
  }

  // Cache for 5 minutes.
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

  return sendJson(res, 200, {
    ok: true,
    name,
    address: resolved.address.toLowerCase(),
  });
}