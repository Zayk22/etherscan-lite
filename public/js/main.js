import { fetchBalance, fetchTransactions, fetchPrice, fetchResolve } from './api.js';
import { getSavedTheme, saveTheme, getRecentSearches, addRecentSearch, clearRecentSearches } from './storage.js';
import { isEthName } from './format.js';
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
  { label: 'Vitalik', address: 'vitalik.eth' },
  { label: 'Binance 14', address: '0x28C6c06298d514Db089934071355E5743bf21d60' },
  { label: 'Jump Trading', address: '0xf584F8728B874a6a5c7A8d4d387C9aae9172D621' }
];

let isFetching = false;
let currentAddress = '';
let currentEthName = null;
let currentEthWei = '0';
let currentEthUsd = null;
let currentTransactions = [];
let currentPage = 0;
let hasMore = false;
let currentFilter = 'all';

function initTheme() {
  setThemeUI(getSavedTheme());
  elements.themeToggle.addEventListener('click', () => {
    const next = document.body.classList.contains('dark') ? 'light' : 'dark';
    setThemeUI(next);
    saveTheme(next);
  });
}

function updateRecentUI() {
  const list = getRecentSearches();
  renderRecentSearches(
    list, 
    (query) => {
      setAddressInput(query);
      handleSearch(query);
    },
    () => {
      clearRecentSearches();
      updateRecentUI();
      toast('Recent searches cleared');
    }
  );
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
  ]);
}

async function handleSearch(overrideInput = null) {
  if (isFetching) return;

  const input = overrideInput || getAddressInput();
  if (!input) return showError('MISSING_ADDRESS');

  const isName = isEthName(input);
  const isAddress = ADDRESS_RE.test(input);

  if (!isName && !isAddress) return showError('INVALID_ADDRESS');

  setAddressInput(input);
  
  isFetching = true;
  let resolvedAddress = input;

  if (isName) {
    setLoading(true, 'Resolving name...');
    try {
      const resolveData = await withTimeout(fetchResolve(input), 6000);
      resolvedAddress = resolveData.address;
      currentEthName = input.toLowerCase();
    } catch (err) {
      isFetching = false;
      setLoading(false);
      return showError(err.message || 'RESOLVER_UNAVAILABLE');
    }
  } else {
    currentEthName = null;
  }

  addRecentSearch(input);
  updateRecentUI();
  
  const url = new URL(window.location);
  url.searchParams.set('address', input);
  window.history.replaceState({}, '', url);

  currentAddress = resolvedAddress.toLowerCase();
  currentPage = 0;
  currentTransactions = [];
  currentFilter = 'all';
  hasMore = false;
  setFilterUI('all');

  setLoading(true, 'Loading data...');

  // Fetch independently. If balance fails, transactions can still succeed.
  let balanceData = null;
  let txData = { transactions: [], hasMore: false };
  let priceData = null;

  try {
    const results = await withTimeout(
      Promise.allSettled([
        fetchBalance(currentAddress),
        fetchPrice(),
        fetchTransactions(currentAddress, 10, 0)
      ]), 
      9000 // 9 seconds max total
    );

    if (results[0].status === 'fulfilled') balanceData = results[0].value;
    if (results[1].status === 'fulfilled') priceData = results[1].value;
    if (results[2].status === 'fulfilled') txData = results[2].value;

  } catch (err) {
    // If the whole thing times out, we might still have partial data, but usually we lose it all.
    console.warn("Global fetch timeout reached.");
  }

  isFetching = false;
  setLoading(false);

  // If BOTH balance and transactions failed, show the error.
  if (!balanceData && txData.transactions.length === 0) {
    return showError('TIMEOUT');
  }

  // Otherwise, show whatever we got.
  currentEthWei = balanceData ? balanceData.eth_wei : '0';
  currentEthUsd = priceData ? priceData.eth_usd : null;
  currentTransactions = txData.transactions;
  hasMore = txData.hasMore;

  // If balance failed, pass a flag so ui.js knows to show "Unavailable"
  showResult({
    address: currentAddress,
    ethName: currentEthName,
    ethWei: currentEthWei,
    ethUsd: currentEthUsd,
    priceError: priceData === null || !balanceData, 
    tokens: balanceData ? balanceData.tokens : [],
  });

  renderTransactions({
    transactions: currentTransactions,
    filter: currentFilter,
    address: currentAddress,
    hasMore: hasMore,
  });
}

async function handleLoadMore() {
  if (isFetching || !hasMore) return;
  
  isFetching = true;
  setLoadMoreLoading(true);
  currentPage++;
  
  try {
    const txData = await withTimeout(fetchTransactions(currentAddress, 10, currentPage), 8000);
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
    currentPage--;
  } finally {
    isFetching = false;
    setLoadMoreLoading(false);
  }
}

function handleFilterChange(newFilter) {
  currentFilter = newFilter;
  renderTransactions({
    transactions: currentTransactions,
    filter: currentFilter,
    address: currentAddress,
    hasMore: hasMore,
  });
}

async function handleCopy() {
  if (!currentAddress) return;
  try {
    await navigator.clipboard.writeText(currentAddress);
    toast('✅ Address copied!');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = currentAddress;
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

  bindFilterButtons(handleFilterChange);
  bindLoadMore(handleLoadMore);

  const params = new URLSearchParams(window.location.search);
  const urlAddress = params.get('address');
  if (urlAddress && (ADDRESS_RE.test(urlAddress) || isEthName(urlAddress))) {
    setAddressInput(urlAddress);
    handleSearch(urlAddress);
  } else {
    elements.addressInput.focus();
  }
});