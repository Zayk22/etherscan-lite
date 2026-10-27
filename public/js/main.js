import { fetchBalance, fetchTransactions, fetchPrice } from './api.js';
import { getSavedTheme, saveTheme, getRecentSearches, addRecentSearch, clearRecentSearches } from './storage.js';
import { 
  elements, 
  getAddressInput, 
  setAddressInput,
  setLoading, 
  showResult, 
  renderTransactions,
  setFilterUI,
  bindFilterButtons,
  bindLoadMore,
  setLoadMoreLoading,
  showError, 
  setThemeUI, 
  toast,
  clearResults,
  renderRecentSearches,
  renderExampleChips
} from './ui.js';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const EXAMPLE_ADDRESSES = [
  { label: 'Vitalik', address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
  { label: 'Binance 14', address: '0x28C6c06298d514Db089934071355E5743bf21d60' },
  { label: 'Jump Trading', address: '0xf584F8728B874a6a5c7A8d4d387C9aae9172D621' }
];

let isFetching = false;
let currentAddress = '';
let currentEthWei = '0';
let currentEthUsd = null;
let currentTransactions = [];
let currentPage = 0;
let hasMore = false;
let currentFilter = 'all';

// ---- Theme ----
function initTheme() {
  setThemeUI(getSavedTheme());
  elements.themeToggle.addEventListener('click', () => {
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    setThemeUI(next);
    saveTheme(next);
  });
}

// ---- Recent Searches ----
function updateRecentUI() {
  const list = getRecentSearches();
  renderRecentSearches(
    list, 
    (addr) => {
      setAddressInput(addr);
      handleSearch(addr);
    },
    () => {
      clearRecentSearches();
      updateRecentUI();
      toast('Recent searches cleared');
    }
  );
}

// ---- Search ----
async function handleSearch(overrideAddress = null) {
  if (isFetching) return;

  const address = overrideAddress || getAddressInput();
  if (!address) return showError('MISSING_ADDRESS');
  if (!ADDRESS_RE.test(address)) return showError('INVALID_ADDRESS');

  // Update UI state and URL
  setAddressInput(address);
  const url = new URL(window.location);
  url.searchParams.set('address', address);
  window.history.replaceState({}, '', url);

  // Save to recent
  addRecentSearch(address);
  updateRecentUI();

  // Reset state
  currentAddress = address.toLowerCase();
  currentPage = 0;
  currentTransactions = [];
  currentFilter = 'all';
  hasMore = false;
  setFilterUI('all');

  isFetching = true;
  setLoading(true);

  const [balanceResult, priceResult, txResult] = await Promise.allSettled([
    fetchBalance(address),
    fetchPrice(),
    fetchTransactions(address, 10, 0),
  ]);

  isFetching = false;
  setLoading(false);

  if (balanceResult.status === 'rejected') {
    showError(balanceResult.reason.message || 'UNKNOWN_ERROR');
    return;
  }

  const balanceData = balanceResult.value;
  const txData = txResult.status === 'fulfilled' ? txResult.value : { transactions: [], hasMore: false };
  const priceData = priceResult.status === 'fulfilled' ? priceResult.value : null;

  currentEthWei = balanceData.eth_wei;
  currentEthUsd = priceData ? priceData.eth_usd : null;
  currentTransactions = txData.transactions;
  hasMore = txData.hasMore;

  showResult({
    address: balanceData.address,
    ethWei: currentEthWei,
    ethUsd: currentEthUsd,
    priceError: priceData === null,
    tokens: balanceData.tokens,
  });

  renderTransactions({
    transactions: currentTransactions,
    filter: currentFilter,
    address: currentAddress,
    hasMore: hasMore,
  });
}

// ---- Load More ----
async function handleLoadMore() {
  if (isFetching || !hasMore) return;
  
  isFetching = true;
  setLoadMoreLoading(true);

  currentPage++;
  
  try {
    const txData = await fetchTransactions(currentAddress, 10, currentPage);
    currentTransactions = [...currentTransactions, ...txData.transactions];
    hasMore = txData.hasMore;

    renderTransactions({
      transactions: currentTransactions,
      filter: currentFilter,
      address: currentAddress,
      hasMore: hasMore,
    });
  } catch (err) {
    toast('Failed to load more transactions');
    currentPage--; // Revert page so retry works
  } finally {
    isFetching = false;
    setLoadMoreLoading(false);
  }
}

// ---- Filter ----
function handleFilterChange(newFilter) {
  currentFilter = newFilter;
  renderTransactions({
    transactions: currentTransactions,
    filter: currentFilter,
    address: currentAddress,
    hasMore: hasMore,
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
  updateRecentUI();
  renderExampleChips(EXAMPLE_ADDRESSES, (addr) => {
    setAddressInput(addr);
    handleSearch(addr);
  });

  elements.searchBtn.addEventListener('click', () => handleSearch());
  elements.addressInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !isFetching) handleSearch();
  });
  elements.copyBtn.addEventListener('click', handleCopy);
  elements.addressInput.addEventListener('input', clearResults);

  // Phase 4 bindings
  bindFilterButtons(handleFilterChange);
  bindLoadMore(handleLoadMore);

  // Load address from URL on page open
  const params = new URLSearchParams(window.location.search);
  const urlAddress = params.get('address');
  if (urlAddress && ADDRESS_RE.test(urlAddress)) {
    setAddressInput(urlAddress);
    handleSearch(urlAddress);
  } else {
    elements.addressInput.focus();
  }
});