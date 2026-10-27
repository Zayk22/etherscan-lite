// Thin wrapper around the three serverless endpoints.
// Every call returns parsed JSON on success or throws an Error with
// the server's error code on failure, so callers can use try/catch
// consistently.
// It also catches fetch-level network failures (e.g., if the server is down)
// and normalizes them to 'NETWORK_ERROR'.

async function getJson(url) {
  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    // Fetch itself threw — offline, DNS failure, or Vercel down.
    throw new Error('NETWORK_ERROR');
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Upstream returned non-JSON (rare — Vercel's 500 page is HTML).
  }

  if (!response.ok) {
    const code = body && typeof body.error === 'string' ? body.error : 'UPSTREAM_ERROR';
    throw new Error(code);
  }
  if (!body || body.ok !== true) {
    throw new Error('UPSTREAM_ERROR');
  }
  return body;
}

export async function fetchBalance(address) {
  return getJson(`/api/balances?address=${encodeURIComponent(address)}`);
}

export async function fetchTransactions(address, limit = 10) {
  return getJson(
    `/api/transactions?address=${encodeURIComponent(address)}&limit=${limit}`
  );
}

export async function fetchPrice() {
  return getJson('/api/price');
}