async function getJson(url, signal) {
  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('ABORTED');
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

export async function fetchBalance(address, signal) {
  return getJson(`/api/balances?address=${encodeURIComponent(address)}`, signal);
}

export async function fetchTokens(address, signal) {
  return getJson(`/api/tokens?address=${encodeURIComponent(address)}`, signal);
}

export async function fetchTransactions(address, limit = 10, page = 0, signal) {
  return getJson(
    `/api/transactions?address=${encodeURIComponent(address)}&limit=${limit}&page=${page}`,
    signal
  );
}

export async function fetchPrice(signal) {
  return getJson('/api/price', signal);
}

export async function fetchResolve(name, signal) {
  return getJson(`/api/resolve?name=${encodeURIComponent(name)}`, signal);
}