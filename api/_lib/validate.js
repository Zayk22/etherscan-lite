// Address validation shared by the API functions.
//
// We only support Ethereum mainnet addresses: 0x followed by exactly
// 40 hexadecimal characters. That's the same rule the old browser code
// used, now enforced on the server so a malicious client can't bypass it
// by editing the request.

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Validate an Ethereum address string.
 * Returns { ok: true, address } on success, { ok: false, error } on failure.
 * `error` is a short uppercase code the frontend can map to a friendly message.
 */
export function validateAddress(raw) {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'MISSING_ADDRESS' };
  }

  const address = raw.trim();

  if (address === '') {
    return { ok: false, error: 'MISSING_ADDRESS' };
  }

  if (!ADDRESS_RE.test(address)) {
    return { ok: false, error: 'INVALID_ADDRESS' };
  }

  return { ok: true, address };
}