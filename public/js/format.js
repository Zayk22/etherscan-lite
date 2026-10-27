// Formatting helpers.
// All wei-to-ETH conversions use BigInt so no precision is lost.
// (1 ETH = 10^18 wei = 1,000,000,000,000,000,000 wei)

const WEI_PER_ETH = 1000000000000000000n; // BigInt literal

/**
 * Convert a wei value (string or BigInt) to a decimal ETH string.
 * Uses BigInt integer division for the whole part and remainder
 * for the fractional part — never floating point.
 * Example: "1234567890000000000" -> "1.234567"
 */
export function weiToEth(weiString, maxFractionDigits = 6) {
  // Guard against bad input
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

  // Pad the remainder to 18 digits, then trim to maxFractionDigits
  const remainderStr = remainder.toString().padStart(18, '0');
  let fraction = remainderStr.slice(0, maxFractionDigits);

  // Trim trailing zeros but leave at least one digit if there was a fraction
  fraction = fraction.replace(/0+$/, '');
  if (fraction === '') fraction = '0';

  const sign = negative ? '-' : '';
  return `${sign}${whole.toString()}.${fraction}`;
}

/**
 * Format a decimal ETH number as a USD currency string.
 * Example: (1.5, 2000) -> "$3,000.00"
 */
export function ethToUsd(ethDecimalString, usdPerEth) {
  // Note: this involves a float multiplication because USD is a fiat
  // amount — 2 decimals is all anyone cares about — but the ETH input
  // string comes from the exact BigInt result above, so no wei is lost.
  const eth = parseFloat(ethDecimalString);
  const usd = eth * usdPerEth;
  if (!Number.isFinite(usd)) return 'Price unavailable';
  return usd.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

/**
 * Shorten a long hex address or hash for display.
 * Example: shortenHash("0xabc...def", 6, 4) -> "0xabc...def"
 */
export function shortenHex(hex, head = 8, tail = 6) {
  if (typeof hex !== 'string' || hex.length <= head + tail + 3) return hex;
  return `${hex.slice(0, head)}...${hex.slice(-tail)}`;
}

/**
 * Format an ISO date string as a readable local time.
 */
export function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

/**
 * Map a server error code to a friendly message.
 * The server only ever sends these codes, so this is the entire list.
 */
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