import { fetchBalance, fetchTokens, fetchTransactions, fetchPrice, fetchResolve } from './api.js';
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
  renderExampleChips,
  showSectionError, // New UI function we'll add in Batch 3
  renderTokens        // New UI function
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

// Search ID counter for ignoring stale requests
let currentSearchId = 0;

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

async function handleSearch(overrideInput = null) {
  if (isFetching) return;

  const input = overrideInput || getAddressInput();
  if (!input) return showError('MISSING_ADDRESS');

  const isName = isEthName(input);
  const isAddress = ADDRESS_RE.test(input);

  if (!isName && !isAddress) return showError('INVALID_ADDRESS');

  setAddressInput(input);
  
  // Increment search ID and cancel old requests
  currentSearchId++;
  const searchId = currentSearchId;
  
  isFetching = true;
  let resolvedAddress = input;

  const resolveController = new AbortController();
  const resolveTimer = setTimeout(() => resolveController.abort(), 8000);

  if (isName) {
    setLoading(true, 'Resolving name...');
    try {
      const resolveData = await fetchResolve(input, resolveController.signal);
      resolvedAddress = resolveData.address;
      currentEthName = input.toLowerCase();
    } catch (err) {
      isFetching = false;
      setLoading(false);
      clearTimeout(resolveTimer);
      if (err.message === 'ABORTED') return showError('UPSTREAM_TIMEOUT');
      return showError(err.message || 'RESOLVER_UNAVAILABLE');
    }
  } else {
    currentEthName = null;
  }
  clearTimeout(resolveTimer);

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
  
  currentEthWei = '0';
  currentEthUsd = null;

  setLoading(true, 'Loading data...');
  isFetching = false; // Allow the UI to be responsive while sections load

  // 1. Fetch Balance (Independent)
  const balanceController = new AbortController();
  const balanceTimer = setTimeout(() => balanceController.abort(), 8000);
  fetchBalance(currentAddress, balanceController.signal)
    .then(data => {
      if (searchId !== currentSearchId) return;
      currentEthWei = data.eth_wei;
      showResult({ address: currentAddress, ethName: currentEthName, ethWei: currentEthWei, ethUsd: currentEthUsd, priceError: currentEthUsd === null });
    })
    .catch(err => {
      if (searchId !== currentSearchId) return;
      if (err.message === 'ABORTED') showSectionError('balance', 'Timed out');
      else showSectionError('balance', err.message);
    })
    .finally(() => {
      clearTimeout(balanceTimer);
      if (searchId === currentSearchId) hideSkeleton('balance');
    });

  // 2. Fetch Price (Independent)
  const priceController = new AbortController();
  const priceTimer = setTimeout(() => priceController.abort(), 8000);
  fetchPrice(priceController.signal)
    .then(data => {
      if (searchId !== currentSearchId) return;
      currentEthUsd = data.eth_usd;
      showResult({ address: currentAddress, ethName: currentEthName, ethWei: currentEthWei, ethUsd: currentEthUsd, priceError: false });
    })
    .catch(err => {
      if (searchId !== currentSearchId) return;
      currentEthUsd = null;
      showResult({ address: currentAddress, ethName: currentEthName, ethWei: currentEthWei, ethUsd: null, priceError: true });
    })
    .finally(() => {
      clearTimeout(priceTimer);
    });

  // 3. Fetch Transactions (Independent)
  const txController = new AbortController();
  const txTimer = setTimeout(() => txController.abort(), 10000);
  fetchTransactions(currentAddress, 10, 0, txController.signal)
    .then(data => {
      if (searchId !== currentSearchId) return;
      currentTransactions = data.transactions;
      hasMore = data.hasMore;
      renderTransactions({ transactions: currentTransactions, filter: currentFilter, address: currentAddress, hasMore: hasMore });
    })
    .catch(err => {
      if (searchId !== currentSearchId) return;
      showSectionError('transactions', err.message);
    })
    .finally(() => {
      clearTimeout(txTimer);
      if (searchId === currentSearchId) hideSkeleton('transactions');
    });

  // 4. Fetch Tokens (Independent)
  const tokenController = new AbortController();
  const tokenTimer = setTimeout(() => tokenController.abort(), 12000);
  fetchTokens(currentAddress, tokenController.signal)
    .then(data => {
      if (searchId !== currentSearchId) return;
      renderTokens(data.tokens);
    })
    .catch(err => {
      if (searchId !== currentSearchId) return;
      showSectionError('tokens', err.message);
    })
    .finally(() => {
      clearTimeout(tokenTimer);
      if (searchId === currentSearchId) hideSkeleton('tokens');
    });
}

async function handleLoadMore() {
  if (isFetching || !hasMore) return;
  
  isFetching = true;
  setLoadMoreLoading(true);
  currentPage++;
  
  const txController = new AbortController();
  const txTimer = setTimeout(() => txController.abort(), 10000);

  try {
    const txData = await fetchTransactions(currentAddress, 10, currentPage, txController.signal);
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
    clearTimeout(txTimer);
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