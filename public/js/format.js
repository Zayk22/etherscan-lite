const WEI_PER_ETH = 1000000000000000000n;

export function weiToEth(weiString, maxFractionDigits = 6) {
  let wei;
  try {
    wei = BigInt(weiString);
  } catch {
    return '0';
  }

  const negative = wei < 0n;
  if (negative) wei = -wei;

  const whole = wei / WEI_PER_ETH;
  const remainder = wei % WEI_PER_ETH;

  const remainderStr = remainder.toString().padStart(18, '0');
  let fraction = remainderStr.slice(0, maxFractionDigits);

  fraction = fraction.replace(/0+$/, '');
  if (fraction === '') fraction = '0';

  const sign = negative ? '-' : '';
  return `${sign}${whole.toString()}.${fraction}`;
}

export function ethToUsd(ethDecimalString, usdPerEth) {
  const eth = parseFloat(ethDecimalString);
  const usd = eth * usdPerEth;
  if (!Number.isFinite(usd)) return 'Price unavailable';
  return usd.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

export function shortenHex(hex, head = 8, tail = 6) {
  if (typeof hex !== 'string' || hex.length <= head + tail + 3) return hex;
  return `${hex.slice(0, head)}...${hex.slice(-tail)}`;
}

export function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

export function errorMessage(code) {
  switch (code) {
    case 'INVALID_ADDRESS':
      return 'Invalid address format. Ethereum addresses start with 0x and have 40 hex characters.';
    case 'MISSING_ADDRESS':
      return 'Please enter an Ethereum address.';
    case 'RATE_LIMIT':
      return 'Rate limit exceeded. Please wait a moment and try again.';
    case 'TIMEOUT':
      return 'The data provider took too long to respond. Please try again.';
    case 'NETWORK_ERROR':
    case 'UPSTREAM_ERROR':
      return 'Network error. Please check your connection and try again.';
    case 'MISSING_API_KEY':
      return 'Server is not configured. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Determine if a transaction is IN, OUT, or SELF relative to a searched address.
 */
export function getDirection(tx, searchedAddress) {
  const from = tx.from_address.toLowerCase();
  const to = tx.to_address.toLowerCase();
  const self = searchedAddress.toLowerCase();

  if (from === self && to === self) return 'SELF';
  if (from === self) return 'OUT';
  if (to === self) return 'IN';
  // Fallback (e.g., contract interactions)
  return 'UNKNOWN';
}