// main.js — the entry point. Wires the UI to the API and coordinates
// the theme, search flow, and copy-address button.
//
// The three API calls (balance, price, transactions) are made with
// Promise.allSettled so a failure in one does not block the others.
// If price fails but balance and transactions succeed, we still show
// the result with a "price unavailable" note.

import { fetchBalance, fetchTransactions, fetchPrice } from './api.js';
import { getSavedTheme, saveTheme } from './storage.js';
import { elements, getAddressInput, setLoading, showResult, showError, setThemeUI, toast } from './ui.js';

// Simple client-side address check. The server also validates — this
// just avoids a pointless round-trip when the input is obviously bad.
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

let isFetching = false;

// ---- Theme ----
function initTheme() {
  setThemeUI(getSavedTheme());
  elements.themeToggle.addEventListener('click', () => {
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    setThemeUI(next);
    saveTheme(next);
  });
}

// ---- Search ----
async function handleSearch() {
  if (isFetching) return;

  const address = getAddressInput();
  if (!address) {
    showError('MISSING_ADDRESS');
    return;
  }
  if (!ADDRESS_RE.test(address)) {
    showError('INVALID_ADDRESS');
    return;
  }

  isFetching = true;
  setLoading(true);

  // allSettled lets each call succeed or fail independently.
  const [balanceResult, priceResult, txResult] = await Promise.allSettled([
    fetchBalance(address),
    fetchPrice(),
    fetchTransactions(address, 10),
  ]);

  isFetching = false;
  setLoading(false);

  // Balance is the anchor. If it failed, show the error and stop —
  // without a balance, the page has nothing meaningful to display.
  if (balanceResult.status === 'rejected') {
    showError(balanceResult.reason.message || 'UNKNOWN_ERROR');
    return;
  }

  const balanceData = balanceResult.value;
  const txData = txResult.status === 'fulfilled' ? txResult.value : { transactions: [] };
  const priceData = priceResult.status === 'fulfilled' ? priceResult.value : null;

  showResult({
    address: balanceData.address,
    ethWei: balanceData.eth_wei,
    transactions: txData.transactions,
    ethUsd: priceData ? priceData.eth_usd : null,
    priceError: priceData === null,
  });
}

// ---- Copy address ----
async function handleCopy() {
  const address = elements.walletAddress.textContent;
  if (!address || !ADDRESS_RE.test(address)) return;
  try {
    await navigator.clipboard.writeText(address);
    toast('✅ Address copied!');
  } catch {
    // Fallback for browsers without clipboard API permission.
    const ta = document.createElement('textarea');
    ta.value = address;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      toast('✅ Address copied!');
    } catch {
      toast('Could not copy');
    }
    ta.remove();
  }
}

// ---- Boot ----
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  elements.searchBtn.addEventListener('click', handleSearch);
  elements.addressInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isFetching) handleSearch();
  });
  elements.copyBtn.addEventListener('click', handleCopy);

  elements.addressInput.focus();

  // Clear stale results when the user starts typing a new address.
  elements.addressInput.addEventListener('input', () => {
    if (elements.resultContent.style.display === 'block') {
      elements.resultContent.style.display = 'none';
      elements.resultPlaceholder.style.display = 'flex';
      elements.errorMessage.style.display = 'none';
    }
  });
});