// UI rendering. All DOM writes use textContent or createElement —
// never innerHTML with anything from the API, so no XSS risk from
// malicious token names or addresses.

import { weiToEth, ethToUsd, shortenHex, formatDate, errorMessage } from './format.js';

// Element references — grabbed once on first import.
const els = {
  addressInput: document.getElementById('addressInput'),
  searchBtn: document.getElementById('searchBtn'),
  resultPlaceholder: document.getElementById('resultPlaceholder'),
  resultContent: document.getElementById('resultContent'),
  errorMessage: document.getElementById('errorMessage'),
  errorText: document.getElementById('errorText'),
  walletAddress: document.getElementById('walletAddress'),
  balanceAmount: document.getElementById('balanceAmount'),
  usdAmount: document.getElementById('usdAmount'),
  copyBtn: document.getElementById('copyBtn'),
  transactionsList: document.getElementById('transactionsList'),
  transactionsEmpty: document.getElementById('transactionsEmpty'),
  etherscanLink: document.getElementById('etherscanLink'),
  balanceSkeleton: document.getElementById('balanceSkeleton'),
  transactionsSkeleton: document.getElementById('transactionsSkeleton'),
  realData: document.getElementById('realData'),
  themeToggle: document.getElementById('themeToggle'),
  themeIcon: document.querySelector('.theme-icon'),
  toastContainer: document.getElementById('toastContainer'),
  // Aria live regions we will add to index.html
  liveRegion: document.getElementById('liveRegion'),
  errorLiveRegion: document.getElementById('errorLiveRegion'),
};

export function getAddressInput() {
  return els.addressInput.value.trim();
}

export function clearInput() {
  els.addressInput.value = '';
}

// Show/hide the initial state when the user starts typing again
export function clearResults() {
  if (els.resultContent.style.display === 'block') {
    els.resultContent.style.display = 'none';
    els.resultPlaceholder.style.display = 'flex';
    els.errorMessage.style.display = 'none';
    announce('', els.liveRegion);
  }
}

function announce(message, region) {
  if (region) {
    region.textContent = message;
  }
}

export function setLoading(isLoading) {
  els.searchBtn.disabled = isLoading;
  els.searchBtn.classList.toggle('loading', isLoading);

  if (isLoading) {
    els.resultPlaceholder.style.display = 'none';
    els.errorMessage.style.display = 'none';
    els.resultContent.style.display = 'block';
    els.realData.style.display = 'none';
    els.balanceSkeleton.style.display = 'block';
    els.transactionsSkeleton.style.display = 'block';
    announce('Loading data...', els.liveRegion);
  }
}

/**
 * Draw a successful result. `priceError` true means the price call
 * failed but we still have balance and transactions — show a note.
 */
export function showResult({ address, ethWei, transactions, ethUsd, priceError }) {
  els.walletAddress.textContent = address;
  els.etherscanLink.href = `https://etherscan.io/address/${address}`;

  const ethString = weiToEth(ethWei, 6);
  els.balanceAmount.textContent = ethString;

  if (priceError || ethUsd == null) {
    els.usdAmount.textContent = 'Price unavailable';
  } else {
    els.usdAmount.textContent = ethToUsd(ethString, ethUsd);
  }

  // Transactions
  els.transactionsList.replaceChildren();
  if (!transactions || transactions.length === 0) {
    els.transactionsEmpty.style.display = 'block';
  } else {
    els.transactionsEmpty.style.display = 'none';
    for (const tx of transactions) {
      els.transactionsList.appendChild(buildTransactionCard(tx));
    }
  }

  els.balanceSkeleton.style.display = 'none';
  els.transactionsSkeleton.style.display = 'none';
  els.realData.style.display = 'block';
  els.resultPlaceholder.style.display = 'none';
  els.errorMessage.style.display = 'none';
  els.resultContent.style.display = 'block';
  
  announce(`Balance: ${ethString} ETH. Loaded ${transactions ? transactions.length : 0} transactions.`, els.liveRegion);
}

function buildTransactionCard(tx) {
  const card = document.createElement('div');
  card.className = 'transaction-card';

  const header = document.createElement('div');
  header.className = 'transaction-header';

  const hash = document.createElement('span');
  hash.className = 'transaction-hash';
  hash.textContent = shortenHex(tx.tx_hash, 10, 8);

  const value = document.createElement('span');
  value.className = 'transaction-value';
  value.textContent = `${weiToEth(tx.value_wei, 6)} ETH`;

  header.appendChild(hash);
  header.appendChild(value);

  const detail = document.createElement('div');
  detail.className = 'transaction-detail';
  const fromTo = document.createElement('span');
  fromTo.className = 'from-to';
  fromTo.textContent =
    `From: ${shortenHex(tx.from_address, 8, 6)} → To: ${shortenHex(tx.to_address, 8, 6)}`;
  detail.appendChild(fromTo);

  const dateDetail = document.createElement('div');
  dateDetail.className = 'transaction-detail';
  dateDetail.textContent = `📅 ${formatDate(tx.block_signed_at)}`;

  card.appendChild(header);
  card.appendChild(detail);
  card.appendChild(dateDetail);
  return card;
}

/**
 * Show an error banner. `code` is one of the server error codes
 * (or "UNKNOWN_ERROR").
 */
export function showError(code) {
  const message = errorMessage(code);
  els.errorText.textContent = '❌ ' + message;
  els.errorMessage.style.display = 'flex';
  els.resultPlaceholder.style.display = 'none';
  els.resultContent.style.display = 'none';
  els.balanceSkeleton.style.display = 'none';
  els.transactionsSkeleton.style.display = 'none';
  els.realData.style.display = 'none';
  
  announce('Error: ' + message, els.errorLiveRegion);
}

export function setThemeUI(theme) {
  document.body.classList.toggle('dark', theme === 'dark');
  if (els.themeIcon) els.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

export function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  els.toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 300);
  }, 2000);
}

// Expose the elements the main.js glue needs to bind events to.
export const elements = els;