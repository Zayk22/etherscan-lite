import { validateAddress } from './_lib/validate.js';
import { sendError, sendJson } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'METHOD_NOT_ALLOWED');

  const address = req.query && req.query.address;
  const check = validateAddress(address);
  if (!check.ok) return sendError(res, 400, check.error);

  const key = process.env.COVALENT_API_KEY;
  if (!key) return sendError(res, 500, 'MISSING_API_KEY');

  const url = `https://api.covalenthq.com/v1/1/address/${address}/balances_v2/?nft=false`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 seconds

  try {
    const upstream = await fetch(url, {
      signal: controller.signal,
      headers: { 'Authorization': `Bearer ${key}`, 'Accept': 'application/json' }
    });

    if (upstream.status === 429) return sendError(res, 429, 'RATE_LIMIT');
    if (!upstream.ok) return sendError(res, 502, 'UPSTREAM_ERROR');

    const body = await upstream.json();
    if (body && body.error) return sendError(res, 502, 'UPSTREAM_ERROR');

    const items = (body && body.data && Array.isArray(body.data.items)) ? body.data.items : [];

    const tokens = items
      .filter(item => item && item.contract_ticker_symbol !== 'ETH' && typeof item.balance === 'string' && item.balance !== '0')
      .slice(0, 50)
      .map(item => ({
        contract_address: item.contract_address,
        contract_ticker_symbol: item.contract_ticker_symbol,
        contract_decimals: item.contract_decimals,
        balance: item.balance,
      }));

    return sendJson(res, 200, { ok: true, address, tokens });

  } catch (err) {
    if (err.name === 'AbortError') {
      return sendError(res, 504, 'UPSTREAM_TIMEOUT');
    }
    return sendError(res, 502, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeoutId);
  }
}