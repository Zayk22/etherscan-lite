async function getJson(url) {
  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new Error('NETWORK_ERROR');
  }
  let body = null;
  try { body = await response.json(); } catch { /* ignore */ }
  if (!response.ok) {
    const code = body && typeof body.error === 'string' ? body.error : 'UPSTREAM_ERROR';
    throw new Error(code);
  }
  if (!body || body.ok !== true) throw new Error('UPSTREAM_ERROR');
  return body;
}

export async function fetchBalance(address) {
  return getJson(`/api/balances?address=${encodeURIComponent(address)}`);
}

export async function fetchTransactions(address, limit = 10, page = 0) {
  return getJson(
    `/api/transactions?address=${encodeURIComponent(address)}&limit=${limit}&page=${page}`
  );
}

export async function fetchPrice() {
  return getJson('/api/price');
}

export async function fetchResolve(name) {
  return getJson(`/api/resolve?name=${encodeURIComponent(name)}`);
}