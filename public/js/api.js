// Thin wrapper around the three serverless endpoints.
// Every call returns parsed JSON on success or throws an Error with
// the server's error code on failure, so callers can use try/catch
// consistently.

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Upstream returned non-JSON (rare — Vercel's 500 page is HTML).
  }

  if (!response.ok) {
    const code = body && typeof body.error === 'string' ? body.error : 'UNKNOWN_ERROR';
    throw new Error(code);
  }
  if (!body || body.ok !== true) {
    throw new Error('UNKNOWN_ERROR');
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