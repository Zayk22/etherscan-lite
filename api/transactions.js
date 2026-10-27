// GET /api/transactions?address=0x...&limit=10

import { validateAddress } from './_lib/validate.js';
import { sendError, sendJson } from './_lib/http.js';

const UPSTREAM = 'https://api.covalenthq.com/v1/1/address';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  const address = req.query && req.query.address;
  const check = validateAddress(address);
  if (!check.ok) {
    return sendError(res, 400, check.error);
  }

  let limit = parseInt(req.query && req.query.limit, 10);
  if (!Number.isFinite(limit) || limit < 1) {
    limit = DEFAULT_LIMIT;
  }
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  const key = process.env.COVALENT_API_KEY;
  if (!key) {
    return sendError(res, 500, 'MISSING_API_KEY');
  }

  const url =
    `${UPSTREAM}/${address}/transactions_v2/` +
    `?key=${encodeURIComponent(key)}&limit=${limit}`;

  let upstream;
  try {
    upstream = await fetch(url, { 
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
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

  if (body && body.error) {
    return sendError(res, 502, 'UPSTREAM_ERROR');
  }

  const items = (body && body.data && Array.isArray(body.data.items))
    ? body.data.items
    : [];

  const transactions = items.map((tx) => ({
    tx_hash: tx.tx_hash || '',
    block_signed_at: tx.block_signed_at || '',
    from_address: (tx.from_address || '').toLowerCase(),
    to_address: (tx.to_address || '').toLowerCase(),
    value_wei: typeof tx.value === 'string' ? tx.value : '0',
    successful: Boolean(tx.successful),
    fees_paid: typeof tx.fees_paid === 'string' ? tx.fees_paid : '0',
  }));

  return sendJson(res, 200, {
    ok: true,
    address: address.toLowerCase(),
    transactions,
  });
}