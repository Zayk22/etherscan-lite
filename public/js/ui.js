import { weiToEth, ethToUsd, shortenHex, formatDate, errorMessage, getDirection } from './format.js';

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
  liveRegion: document.getElementById('liveRegion'),
  errorLiveRegion: document.getElementById('errorLiveRegion'),
  recentSearchesContainer: document.getElementById('recentSearchesContainer'),
  recentSearchesList: document.getElementById('recentSearchesList'),
  clearRecentBtn: document.getElementById('clearRecentBtn'),
  exampleChipsContainer: document.getElementById('exampleChipsContainer'),
};

export function getAddressInput() {
  return els.addressInput.value.trim();
}

export function setAddressInput(address) {
  els.addressInput.value = address;
}

export function clearResults() {
  if (els.resultContent.style.display === 'block') {
    els.resultContent.style.display = 'none';
    els.resultPlaceholder.style.display = 'flex';
    els.errorMessage.style.display = 'none';
    announce('', els.liveRegion);
  }
}

function announce(message, region) {
  if (region) region.textContent = message;
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

  els.transactionsList.replaceChildren();
  if (!transactions || transactions.length === 0) {
    els.transactionsEmpty.style.display = 'block';
  } else {
    els.transactionsEmpty.style.display = 'none';
    for (const tx of transactions) {
      els.transactionsList.appendChild(buildTransactionCard(tx, address));
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

// Helper to create Lucide SVGs dynamically
function createLucideIcon(pathDataArray, size = 14) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  pathDataArray.forEach(tag => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag.name);
    Object.entries(tag.attrs).forEach(([k, v]) => el.setAttribute(k, v));
    svg.appendChild(el);
  });
  return svg;
}

function buildTransactionCard(tx, searchedAddress) {
  const card = document.createElement('div');
  card.className = 'transaction-card';

  const header = document.createElement('div');
  header.className = 'transaction-header';

  // Direction logic & icon
  const direction = getDirection(tx, searchedAddress);
  
  let iconPaths;
  let iconColorClass;
  let labelText;

  if (direction === 'IN') {
    // ArrowDownLeft
    iconPaths = [
      { name: 'path', attrs: { d: 'M17 7 7 17' } },
      { name: 'path', attrs: { d: 'M17 17H7V7' } }
    ];
    iconColorClass = 'tx-in';
    labelText = 'IN';
  } else if (direction === 'OUT') {
    // ArrowUpRight
    iconPaths = [
      { name: 'path', attrs: { d: 'M7 7h10v10' } },
      { name: 'path', attrs: { d: 'M7 17 17 7' } }
    ];
    iconColorClass = 'tx-out';
    labelText = 'OUT';
  } else {
    // ArrowLeftRight (SELF)
    iconPaths = [
      { name: 'path', attrs: { d: 'M8 3 4 7l4 4' } },
      { name: 'path', attrs: { d: 'M4 7h16' } },
      { name: 'path', attrs: { d: 'm16 21 4-4-4-4' } },
      { name: 'path', attrs: { d: 'M20 17H4' } }
    ];
    iconColorClass = 'tx-self';
    labelText = 'SELF';
  }

  const badge = document.createElement('span');
  badge.className = `tx-badge ${iconColorClass}`;
  badge.style.display = 'inline-flex';
  badge.style.alignItems = 'center';
  badge.style.gap = '4px';
  badge.appendChild(createLucideIcon(iconPaths, 12));
  badge.appendChild(document.createTextNode(labelText));

  // Status Badge
  const status = document.createElement('span');
  status.className = `tx-status ${tx.successful ? 'status-success' : 'status-failed'}`;
  status.textContent = tx.successful ? 'Success' : 'Failed';

  const badgeWrapper = document.createElement('div');
  badgeWrapper.style.display = 'flex';
  badgeWrapper.style.gap = '8px';
  badgeWrapper.appendChild(badge);
  badgeWrapper.appendChild(status);

  // Hash as Etherscan Link + Icon
  const hashLink = document.createElement('a');
  hashLink.className = 'transaction-hash';
  hashLink.href = `https://etherscan.io/tx/${tx.tx_hash}`;
  hashLink.target = '_blank';
  hashLink.rel = 'noopener noreferrer';
  hashLink.textContent = shortenHex(tx.tx_hash, 10, 8);
  
  // External link icon
  hashLink.appendChild(createLucideIcon([
    { name: 'path', attrs: { d: 'M15 3h6v6' } },
    { name: 'path', attrs: { d: 'M10 14 21 3' } },
    { name: 'path', attrs: { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' } }
  ], 12));
  hashLink.style.marginLeft = 'auto'; 

  header.appendChild(badgeWrapper);
  header.appendChild(hashLink);

  // From / To row
  const detail = document.createElement('div');
  detail.className = 'transaction-detail';
  detail.innerHTML = `<span class="from-to">${shortenHex(tx.from_address, 6, 4)}</span> 
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 8px; opacity: 0.5;"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                      <span class="from-to">${shortenHex(tx.to_address, 6, 4)}</span>`;

  // Value & Gas row
  const valueDetail = document.createElement('div');
  valueDetail.className = 'transaction-detail';
  
  const valueText = document.createElement('span');
  valueText.className = 'transaction-value';
  valueText.textContent = `${weiToEth(tx.value_wei, 6)} ETH`;
  
  const gasText = document.createElement('span');
  gasText.style.color = 'var(--text-muted)';
  gasText.style.fontSize = '0.8rem';
  gasText.textContent = `Gas: ${weiToEth(tx.fees_paid, 6)} ETH`;

  valueDetail.appendChild(valueText);
  valueDetail.appendChild(gasText);

  // Date row
  const dateDetail = document.createElement('div');
  dateDetail.className = 'transaction-detail';
  dateDetail.style.fontSize = '0.8rem';
  dateDetail.style.opacity = '0.7';
  dateDetail.textContent = formatDate(tx.block_signed_at);

  card.appendChild(header);
  card.appendChild(detail);
  card.appendChild(valueDetail);
  card.appendChild(dateDetail);

  return card;
}

export function showError(code) {
  const message = errorMessage(code);
  els.errorText.textContent = message;
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
  if (els.themeIcon) {
    if (theme === 'dark') {
      // Sun Icon
      els.themeIcon.innerHTML = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>';
    } else {
      // Moon Icon
      els.themeIcon.innerHTML = '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>';
    }
  }
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

export function renderRecentSearches(list, onSelect, onClear) {
  if (list.length === 0) {
    els.recentSearchesContainer.style.display = 'none';
    return;
  }
  els.recentSearchesContainer.style.display = 'flex';
  els.recentSearchesList.replaceChildren();

  list.forEach(address => {
    const btn = document.createElement('button');
    btn.className = 'chip-btn';
    btn.textContent = shortenHex(address, 6, 4);
    btn.title = address;
    btn.addEventListener('click', () => onSelect(address));
    els.recentSearchesList.appendChild(btn);
  });

  els.clearRecentBtn.replaceWith(els.clearRecentBtn.cloneNode(true));
  els.clearRecentBtn = document.getElementById('clearRecentBtn');
  els.clearRecentBtn.addEventListener('click', onClear);
}

export function renderExampleChips(addresses, onSelect) {
  if (!els.exampleChipsContainer) return;
  els.exampleChipsContainer.replaceChildren();
  addresses.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'chip-btn';
    btn.textContent = item.label;
    btn.title = item.address;
    btn.addEventListener('click', () => onSelect(item.address));
    els.exampleChipsContainer.appendChild(btn);
  });
}

export const elements = els;