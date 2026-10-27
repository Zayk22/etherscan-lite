import { validateAddress } from './_lib/validate.js';
import { sendError, sendJson } from './_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return sendError(res, 405, 'METHOD_NOT_ALLOWED');

  const address = req.query && req.query.address;
  const check = validateAddress(address);
  if (!check.ok) return sendError(res, 400, check.error);

  const key = process.env.COVALENT_API_KEY;
  if (!key) return sendError(res, 500, 'MISSING_API_KEY');

  const url = `https://api.covalenthq.com/v1/eth-mainnet/address/${address}/balances_native/`;
  
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
    const eth = items.find(item => item && item.contract_ticker_symbol === 'ETH');
    const ethWei = eth && typeof eth.balance === 'string' ? eth.balance : '0';

    return sendJson(res, 200, { ok: true, address, eth_wei: ethWei });

  } catch (err) {
    if (err.name === 'AbortError') {
      return sendError(res, 504, 'UPSTREAM_TIMEOUT');
    }
    return sendError(res, 502, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeoutId);
  }
}