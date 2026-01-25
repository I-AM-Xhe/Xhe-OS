/**
 * XHE KERNEL - UI LAYER
 * 
 * AUTHORITY BOUNDARY:
 * This layer may ONLY:
 * - Send intents to kernel
 * - Render results from kernel
 * - Display logs from kernel events
 * 
 * This layer MUST NOT:
 * - Generate addresses
 * - Mutate state
 * - Emit pulses
 * - Hash content
 */

import { 
  xheKernel, 
  parseAddress, 
  RESOLUTION_STATE, 
  PULSE_TYPE,
  timeString 
} from './kernel.js';

// ============================================
// DOM UTILITIES (Pure)
// ============================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') el.className = value;
    else if (key === 'dataset') Object.entries(value).forEach(([k, v]) => el.dataset[k] = v);
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value);
  });

  children.forEach(child => {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child) el.appendChild(child);
  });

  return el;
}

// ============================================
// TOAST (Visual Feedback)
// ============================================

function showToast(message, type = 'info', duration = 3000) {
  const container = $('#toast-container');
  const toast = createElement('div', { 
    className: `toast ${type}`,
    dataset: { testid: 'toast-message' }
  }, [message]);
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================
// CONSOLE (Kernel Event Listener Only)
// ============================================

function appendToConsole(type, message, pulseId = null) {
  const output = $('#console-output');
  if (!output) return;
  
  const entry = createElement('div', {
    className: `console-entry ${type}`,
    dataset: pulseId ? { pulseId } : {}
  }, [
    createElement('span', { className: 'entry-time' }, [timeString()]),
    createElement('span', { className: 'entry-type' }, [`[${type.toUpperCase()}]`]),
    createElement('span', { className: 'entry-msg' }, [message])
  ]);
  
  output.appendChild(entry);
  output.scrollTop = output.scrollHeight;
  
  // Limit console entries
  while (output.children.length > 100) {
    output.removeChild(output.firstChild);
  }
}

// ============================================
// ADDRESS INDEX RENDERING
// ============================================

function renderAddressIndex(filter = 'all') {
  const container = $('#book-entries');
  if (!container) return;
  
  const entries = xheKernel.getAddressIndex(filter);
  
  container.innerHTML = '';
  
  if (entries.length === 0) {
    container.innerHTML = `
      <div class="empty-state" data-testid="empty-state">
        <span>No addresses in index.</span>
        <span class="hint">Generate addresses to populate.</span>
      </div>
    `;
    return;
  }
  
  entries.forEach(entry => {
    const schemeClass = entry.type === 'did:xhe' ? 'did' : entry.type;
    
    const entryEl = createElement('div', {
      className: 'book-entry',
      dataset: { testid: 'book-entry', address: entry.address },
      onClick: () => {
        $('#resolve-input').value = entry.address;
        showToast('Address copied to resolver', 'info');
      }
    }, [
      createElement('code', { className: `entry-address ${schemeClass}` }, 
        [truncateAddress(entry.address)]),
      createElement('span', { className: 'entry-preview' }, [entry.preview || '—']),
      createElement('span', { className: 'entry-time' }, 
        [new Date(entry.timestamp).toLocaleString()])
    ]);
    
    container.appendChild(entryEl);
  });
}

function truncateAddress(address) {
  if (address.length <= 50) return address;
  return `${address.slice(0, 30)}...${address.slice(-12)}`;
}

// ============================================
// IDENTITY & STATS RENDERING
// ============================================

function updateIdentityPanel() {
  const identity = xheKernel.getIdentity();
  const stats = xheKernel.getStats();
  
  const didEl = $('#current-did');
  const pulseEl = $('#pulse-count');
  const addressEl = $('#address-count');
  const balanceEl = $('#slip-balance');
  
  if (didEl) didEl.textContent = identity.did;
  if (pulseEl) pulseEl.textContent = stats.pulseCount;
  if (addressEl) addressEl.textContent = stats.addressCount;
  if (balanceEl) balanceEl.textContent = stats.slipBalance;
}

// ============================================
// FEED RENDERING
// ============================================

function renderFeed() {
  const container = $('#feed-entries');
  if (!container) return;
  
  const posts = xheKernel.getGlobalFeed(20);
  
  container.innerHTML = '';
  
  if (posts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span>No posts yet.</span>
        <span class="hint">Create your first post.</span>
      </div>
    `;
    return;
  }
  
  posts.forEach(post => {
    const postEl = createElement('div', {
      className: 'feed-post',
      dataset: { testid: 'feed-post', hash: post.hash }
    }, [
      createElement('div', { className: 'post-header' }, [
        createElement('code', { className: 'post-author' }, 
          [post.author.slice(0, 20) + '...']),
        createElement('span', { className: 'post-time' }, 
          [new Date(post.timestamp).toLocaleTimeString()])
      ]),
      createElement('p', { className: 'post-content' }, [post.content]),
      createElement('div', { className: 'post-footer' }, [
        createElement('code', { className: 'post-address' }, 
          [truncateAddress(post.address)])
      ])
    ]);
    
    container.appendChild(postEl);
  });
}

// ============================================
// CHANNELS RENDERING
// ============================================

function renderChannels() {
  const container = $('#channel-list');
  if (!container) return;
  
  const channels = xheKernel.getChannels();
  
  container.innerHTML = '';
  
  if (channels.length === 0) {
    container.innerHTML = `<div class="empty-state"><span>No channels.</span></div>`;
    return;
  }
  
  channels.forEach(channel => {
    const chEl = createElement('div', {
      className: 'channel-item',
      dataset: { testid: 'channel-item', id: channel.id },
      onClick: () => selectChannel(channel.id)
    }, [
      createElement('span', { className: 'channel-name' }, [`# ${channel.name}`]),
      createElement('span', { className: 'channel-count' }, 
        [`${channel.posts.length} posts`])
    ]);
    
    container.appendChild(chEl);
  });
}

function selectChannel(channelId) {
  const channel = xheKernel.channels[channelId];
  if (!channel) return;
  
  // Update channel view
  const header = $('#channel-header');
  const posts = $('#channel-posts');
  
  if (header) header.textContent = `# ${channel.name}`;
  if (posts) {
    posts.innerHTML = '';
    channel.posts.forEach(post => {
      const postEl = createElement('div', { className: 'channel-post' }, [
        createElement('p', {}, [post.content]),
        createElement('span', { className: 'post-time' }, 
          [new Date(post.timestamp).toLocaleTimeString()])
      ]);
      posts.appendChild(postEl);
    });
  }
  
  // Store selected channel
  window.selectedChannel = channelId;
}

// ============================================
// SLIP HISTORY RENDERING
// ============================================

function renderSlipHistory() {
  const container = $('#slip-history');
  if (!container) return;
  
  const history = xheKernel.getSlipHistory(10);
  
  container.innerHTML = '';
  
  if (history.length === 0) {
    container.innerHTML = `<div class="empty-state"><span>No transactions.</span></div>`;
    return;
  }
  
  history.forEach(tx => {
    const isIncoming = tx.to === xheKernel.getDID();
    const txEl = createElement('div', {
      className: `slip-tx ${isIncoming ? 'incoming' : 'outgoing'}`,
      dataset: { testid: 'slip-tx' }
    }, [
      createElement('span', { className: 'tx-type' }, [tx.type]),
      createElement('span', { className: 'tx-amount' }, 
        [`${isIncoming ? '+' : '-'}${tx.amount}`]),
      createElement('span', { className: 'tx-time' }, 
        [new Date(tx.timestamp).toLocaleTimeString()])
    ]);
    
    container.appendChild(txEl);
  });
}

// ============================================
// RESOLUTION STATE DISPLAY
// ============================================

function displayResolutionResult(result) {
  const resolvedType = $('#resolved-type');
  const resolvedStatus = $('#resolved-status');
  const resolvedContent = $('#resolved-content');
  
  if (!resolvedType || !resolvedStatus || !resolvedContent) return;
  
  resolvedType.textContent = result.type;
  
  // Color-coded status based on resolution state
  const stateColors = {
    [RESOLUTION_STATE.RESOLVED]: 'var(--accent-success)',
    [RESOLUTION_STATE.KNOWN_BUT_UNAVAILABLE]: 'var(--accent-pulse)',
    [RESOLUTION_STATE.UNKNOWN]: 'var(--accent-danger)',
    [RESOLUTION_STATE.FORBIDDEN]: 'var(--accent-danger)',
    [RESOLUTION_STATE.INVALID]: 'var(--text-muted)'
  };
  
  const stateLabels = {
    [RESOLUTION_STATE.RESOLVED]: 'Resolved',
    [RESOLUTION_STATE.KNOWN_BUT_UNAVAILABLE]: 'Known (Unavailable)',
    [RESOLUTION_STATE.UNKNOWN]: 'Unknown',
    [RESOLUTION_STATE.FORBIDDEN]: 'Forbidden',
    [RESOLUTION_STATE.INVALID]: 'Invalid'
  };
  
  resolvedStatus.textContent = stateLabels[result.state] || result.state;
  resolvedStatus.style.color = stateColors[result.state] || 'var(--text-secondary)';
  
  if (result.state === RESOLUTION_STATE.RESOLVED) {
    resolvedContent.textContent = result.content || '—';
  } else {
    resolvedContent.textContent = result.error || 'Resolution failed';
  }
}

// ============================================
// INTENT HANDLERS (Send to Kernel)
// ============================================

async function handleGenerateAddress() {
  const contentInput = $('#content-input');
  const namespaceSelect = $('#namespace-select');
  const pulseSequence = $('#pulse-sequence');
  const resultAddress = $('#result-address');
  
  const content = contentInput.value.trim();
  const namespace = namespaceSelect.value;
  
  if (!content) {
    showToast('Content required', 'warning');
    return;
  }
  
  try {
    const options = {};
    if (namespace === 'pulse') {
      options.sequence = pulseSequence.value || undefined;
    }
    
    // INTENT: Request kernel to generate address
    const result = await xheKernel.generateAddress(content, namespace, options);
    
    resultAddress.textContent = result.address;
    resultAddress.dataset.fullAddress = result.address;
    
    showToast(`Address generated: ${namespace}://`, 'success');
    
    renderAddressIndex(getCurrentFilter());
    updateIdentityPanel();
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleResolveAddress() {
  const resolveInput = $('#resolve-input');
  const address = resolveInput.value.trim();
  
  if (!address) {
    showToast('Address required', 'warning');
    return;
  }
  
  try {
    // INTENT: Request kernel to resolve address
    const result = await xheKernel.resolveAddress(address);
    
    displayResolutionResult(result);
    
    if (result.state === RESOLUTION_STATE.RESOLVED) {
      showToast('Address resolved', 'success');
    } else {
      showToast(`Resolution: ${result.state}`, 'warning');
    }
    
    updateIdentityPanel();
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function handleCopyAddress() {
  const resultAddress = $('#result-address');
  const fullAddress = resultAddress.dataset.fullAddress || resultAddress.textContent;
  
  if (fullAddress && fullAddress !== '—') {
    navigator.clipboard.writeText(fullAddress)
      .then(() => showToast('Copied', 'success'))
      .catch(() => showToast('Copy failed', 'error'));
  }
}

function handleNamespaceChange() {
  const namespace = $('#namespace-select').value;
  const pulseOptions = $('#pulse-options');
  if (pulseOptions) {
    pulseOptions.style.display = namespace === 'pulse' ? 'block' : 'none';
  }
}

function handleFilterChange(event) {
  const btn = event.target;
  if (!btn.classList.contains('filter-btn')) return;
  
  $$('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  renderAddressIndex(btn.dataset.filter);
}

function getCurrentFilter() {
  const activeBtn = $('.filter-btn.active');
  return activeBtn ? activeBtn.dataset.filter : 'all';
}

function handleExportKernel() {
  const data = xheKernel.exportKernelState();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `xhe-kernel-${Date.now()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
  showToast('Kernel state exported', 'success');
}

function handleImportKernel() {
  $('#import-file').click();
}

function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const result = xheKernel.importKernelState(e.target.result);
    
    if (result.imported > 0) {
      showToast(`Imported ${result.imported} items`, 'success');
      renderAddressIndex(getCurrentFilter());
      renderFeed();
      updateIdentityPanel();
    } else if (result.errors.length > 0) {
      showToast(`Import failed: ${result.errors[0]}`, 'error');
    } else {
      showToast('No new items', 'info');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function handleClearIndex() {
  if (confirm('Clear address index? (Kernel content preserved)')) {
    xheKernel.clearAddressIndex();
    renderAddressIndex('all');
    showToast('Index cleared (content preserved)', 'warning');
  }
}

function handleClearConsole() {
  const output = $('#console-output');
  if (output) output.innerHTML = '';
  appendToConsole('info', 'Console cleared');
}

function handleToggleIdentity() {
  const content = $('#identity-content');
  const btn = $('#toggle-identity-btn');
  
  if (content && btn) {
    content.classList.toggle('collapsed');
    btn.textContent = content.classList.contains('collapsed') ? '+' : '−';
  }
}

async function handleNewIdentity() {
  if (confirm('Generate new identity? (History preserved for audit)')) {
    await xheKernel.regenerateIdentity();
    updateIdentityPanel();
    showToast('New identity generated', 'success');
  }
}

// ============================================
// SOCIAL HANDLERS
// ============================================

async function handleCreatePost() {
  const input = $('#post-input');
  if (!input) return;
  
  const content = input.value.trim();
  if (!content) {
    showToast('Post content required', 'warning');
    return;
  }
  
  try {
    const options = {};
    if (window.selectedChannel) {
      options.channel = window.selectedChannel;
    }
    
    await xheKernel.createPost(content, options);
    
    input.value = '';
    renderFeed();
    renderChannels();
    updateIdentityPanel();
    showToast('Post created', 'success');
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleCreateChannel() {
  const nameInput = $('#channel-name-input');
  if (!nameInput) return;
  
  const name = nameInput.value.trim();
  if (!name) {
    showToast('Channel name required', 'warning');
    return;
  }
  
  try {
    await xheKernel.createChannel(name);
    
    nameInput.value = '';
    renderChannels();
    updateIdentityPanel();
    showToast(`Channel #${name} created`, 'success');
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ============================================
// SLIP HANDLERS
// ============================================

async function handleMintSlips() {
  const amountInput = $('#mint-amount');
  if (!amountInput) return;
  
  const amount = parseInt(amountInput.value, 10);
  if (!amount || amount <= 0) {
    showToast('Valid amount required', 'warning');
    return;
  }
  
  try {
    await xheKernel.mintSlips(amount, 'USER_MINT');
    
    amountInput.value = '';
    renderSlipHistory();
    updateIdentityPanel();
    showToast(`Minted ${amount} slips`, 'success');
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function handleTransferSlips() {
  const toInput = $('#transfer-to');
  const amountInput = $('#transfer-amount');
  
  if (!toInput || !amountInput) return;
  
  const to = toInput.value.trim();
  const amount = parseInt(amountInput.value, 10);
  
  if (!to || !to.startsWith('did:xhe:')) {
    showToast('Valid DID required', 'warning');
    return;
  }
  
  if (!amount || amount <= 0) {
    showToast('Valid amount required', 'warning');
    return;
  }
  
  try {
    await xheKernel.transferSlips(to, amount);
    
    toInput.value = '';
    amountInput.value = '';
    renderSlipHistory();
    updateIdentityPanel();
    showToast(`Transferred ${amount} slips`, 'success');
    
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ============================================
// TAB NAVIGATION
// ============================================

function handleTabChange(event) {
  const btn = event.target.closest('.tab-btn') || event.target;
  if (!btn || !btn.classList.contains('tab-btn')) return;
  
  const tabId = btn.dataset.tab;
  if (!tabId) return;
  
  // Update tab buttons
  $$('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  // Update tab panels
  $$('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `${tabId}-panel`);
  });
  
  // Refresh relevant data
  if (tabId === 'feed') renderFeed();
  if (tabId === 'channels') renderChannels();
  if (tabId === 'slips') {
    renderSlipHistory();
    updateSlipsBalance();
  }
}

function updateSlipsBalance() {
  const mainBalance = $('#slip-balance-main');
  if (mainBalance) {
    mainBalance.textContent = xheKernel.getSlipBalance();
  }
}

// ============================================
// KERNEL EVENT LISTENERS (Console = Witness)
// ============================================

function setupKernelListeners() {
  // Console logs come ONLY from kernel events
  xheKernel.on('kernel:pulse', (pulse) => {
    const typeLabels = {
      [PULSE_TYPE.ADDRESS_GENERATE]: 'Address generated',
      [PULSE_TYPE.ADDRESS_RESOLVE]: 'Address resolved',
      [PULSE_TYPE.IDENTITY_CREATE]: 'Identity created',
      [PULSE_TYPE.IDENTITY_REGENERATE]: 'Identity regenerated',
      [PULSE_TYPE.SLIP_MINT]: 'Slips minted',
      [PULSE_TYPE.SLIP_TRANSFER]: 'Slips transferred',
      [PULSE_TYPE.POST_CREATE]: 'Post created',
      [PULSE_TYPE.CHANNEL_CREATE]: 'Channel created',
      [PULSE_TYPE.KERNEL_INIT]: 'Kernel initialized',
      [PULSE_TYPE.KERNEL_RESET]: 'Kernel reset'
    };
    
    const label = typeLabels[pulse.type] || pulse.type;
    appendToConsole('info', `${label} [${pulse.sequence}]`, pulse.id);
  });
  
  xheKernel.on('kernel:identity:changed', ({ oldDid, newDid }) => {
    appendToConsole('warning', `Identity changed: ${newDid.slice(0, 20)}...`);
    updateIdentityPanel();
  });
  
  xheKernel.on('kernel:index:cleared', () => {
    appendToConsole('warning', 'Address index cleared');
  });
  
  xheKernel.on('kernel:reset', ({ preserveIdentity }) => {
    appendToConsole('warning', `Kernel reset (identity ${preserveIdentity ? 'preserved' : 'regenerated'})`);
  });
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (document.activeElement === $('#content-input')) {
        e.preventDefault();
        handleGenerateAddress();
      } else if (document.activeElement === $('#resolve-input')) {
        e.preventDefault();
        handleResolveAddress();
      } else if (document.activeElement === $('#post-input')) {
        e.preventDefault();
        handleCreatePost();
      }
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================

function init() {
  // Address generation
  const genBtn = $('#generate-btn');
  if (genBtn) genBtn.addEventListener('click', handleGenerateAddress);
  
  const resBtn = $('#resolve-btn');
  if (resBtn) resBtn.addEventListener('click', handleResolveAddress);
  
  const copyBtn = $('#copy-address-btn');
  if (copyBtn) copyBtn.addEventListener('click', handleCopyAddress);
  
  const nsSelect = $('#namespace-select');
  if (nsSelect) nsSelect.addEventListener('change', handleNamespaceChange);
  
  // Filters
  const filters = $('.book-filters');
  if (filters) filters.addEventListener('click', handleFilterChange);
  
  // Export/Import
  const exportBtn = $('#export-book-btn');
  if (exportBtn) exportBtn.addEventListener('click', handleExportKernel);
  
  const importBtn = $('#import-book-btn');
  if (importBtn) importBtn.addEventListener('click', handleImportKernel);
  
  const importFile = $('#import-file');
  if (importFile) importFile.addEventListener('change', handleFileImport);
  
  const clearBtn = $('#clear-book-btn');
  if (clearBtn) clearBtn.addEventListener('click', handleClearIndex);
  
  // Console
  const clearConsoleBtn = $('#clear-console-btn');
  if (clearConsoleBtn) clearConsoleBtn.addEventListener('click', handleClearConsole);
  
  // Identity
  const toggleIdBtn = $('#toggle-identity-btn');
  if (toggleIdBtn) toggleIdBtn.addEventListener('click', handleToggleIdentity);
  
  const newIdBtn = $('#new-identity-btn');
  if (newIdBtn) newIdBtn.addEventListener('click', handleNewIdentity);
  
  // Tabs - attach to each button directly for reliable click handling
  $$('.tab-btn').forEach(btn => {
    btn.addEventListener('click', handleTabChange);
  });
  
  // Social
  const postBtn = $('#post-btn');
  if (postBtn) postBtn.addEventListener('click', handleCreatePost);
  
  const channelBtn = $('#create-channel-btn');
  if (channelBtn) channelBtn.addEventListener('click', handleCreateChannel);
  
  // Slips
  const mintBtn = $('#mint-btn');
  if (mintBtn) mintBtn.addEventListener('click', handleMintSlips);
  
  const transferBtn = $('#transfer-btn');
  if (transferBtn) transferBtn.addEventListener('click', handleTransferSlips);
  
  // Setup kernel event listeners
  setupKernelListeners();
  setupKeyboardShortcuts();
  
  // Initial render
  renderAddressIndex('all');
  renderFeed();
  renderChannels();
  renderSlipHistory();
  updateIdentityPanel();
  
  // Initial console message
  appendToConsole('info', `Kernel v${xheKernel.kernelMeta.version} | ${xheKernel.getDID().slice(0, 24)}...`);
  appendToConsole('info', 'Resolution is computation, not networking.');
  
  console.log('[UI] XHE Kernel Console initialized');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
