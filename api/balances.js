import { validateAddress } from './_lib/validate.js';
import { sendError, sendJson } from './_lib/http.js';

const UPSTREAM = 'https://api.covalenthq.com/v1/1/address';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  const address = req.query && req.query.address;
  const check = validateAddress(address);
  if (!check.ok) {
    return sendError(res, 400, check.error);
  }

  const key = process.env.COVALENT_API_KEY;
  if (!key) {
    return sendError(res, 500, 'MISSING_API_KEY');
  }

  const url = `${UPSTREAM}/${address}/balances_v2/?key=${encodeURIComponent(key)}&nft=false`;

  let upstream;
  try {
    upstream = await fetch(url, { 
      // 8 seconds is fine now
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
  } catch (err) {
    if (err && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      return sendError(res, 504, 'TIMEOUT');
    }
    return sendError(res, 502, 'NETWORK_ERROR');
  }

  if (upstream.status === 429) return sendError(res, 429, 'RATE_LIMIT');
  if (!upstream.ok) return sendError(res, 502, 'UPSTREAM_ERROR');

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

  const eth = items.find(
    (item) => item && item.contract_ticker_symbol === 'ETH'
  );
  const ethWei = eth && typeof eth.balance === 'string' ? eth.balance : '0';

  // Only return the top 50 tokens, sorted by balance, to stop huge payloads
  const tokens = items
    .filter(
      (item) =>
        item &&
        item.contract_ticker_symbol !== 'ETH' &&
        typeof item.balance === 'string' &&
        item.balance !== '0'
    )
    .slice(0, 50)
    .map((item) => ({
      contract_address: item.contract_address,
      contract_ticker_symbol: item.contract_ticker_symbol,
      contract_decimals: item.contract_decimals,
      balance: item.balance,
    }));

  return sendJson(res, 200, {
    ok: true,
    address,
    eth_wei: ethWei,
    tokens,
  });
}