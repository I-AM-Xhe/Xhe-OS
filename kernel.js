/**
 * XHE KERNEL
 * Identity + Addressing + Pulse + Slips + Social System
 * 
 * AUTHORITY BOUNDARY:
 * The kernel is the ONLY source of:
 * - Address generation
 * - Address resolution
 * - Pulse emission
 * - Identity management
 * - Slip operations
 * - Social graph mutations
 * 
 * The UI layer may ONLY:
 * - Send intents
 * - Render results
 * - Display logs
 * 
 * Resolution is computation, not networking.
 */

// ============================================
// RESOLUTION STATES (Structured Truth)
// ============================================

const RESOLUTION_STATE = Object.freeze({
  RESOLVED: 'RESOLVED',                    // Content found and verified
  KNOWN_BUT_UNAVAILABLE: 'KNOWN_BUT_UNAVAILABLE', // Address known, content missing
  UNKNOWN: 'UNKNOWN',                      // Address not in kernel state
  FORBIDDEN: 'FORBIDDEN',                  // Access denied by capability
  INVALID: 'INVALID'                       // Malformed address
});

// ============================================
// URI SCHEMES
// ============================================

const URI_SCHEMES = Object.freeze({
  XHE: 'xhe',
  DID_XHE: 'did:xhe',
  PULSE: 'pulse',
  IPFS: 'ipfs',
  SLIP: 'slip',
  FEED: 'feed',
  CHANNEL: 'channel'
});

// ============================================
// PULSE TYPES (Canonical Actions)
// ============================================

const PULSE_TYPE = Object.freeze({
  // Kernel events
  KERNEL_INIT: 'KERNEL_INIT',
  KERNEL_RESET: 'KERNEL_RESET',
  
  // Identity events
  IDENTITY_CREATE: 'IDENTITY_CREATE',
  IDENTITY_REGENERATE: 'IDENTITY_REGENERATE',
  
  // Address events
  ADDRESS_GENERATE: 'ADDRESS_GENERATE',
  ADDRESS_RESOLVE: 'ADDRESS_RESOLVE',
  
  // Slip events (economic layer)
  SLIP_MINT: 'SLIP_MINT',
  SLIP_TRANSFER: 'SLIP_TRANSFER',
  SLIP_BURN: 'SLIP_BURN',
  
  // Social events
  POST_CREATE: 'POST_CREATE',
  POST_REPLY: 'POST_REPLY',
  POST_REPOST: 'POST_REPOST',
  FOLLOW: 'FOLLOW',
  UNFOLLOW: 'UNFOLLOW',
  CHANNEL_CREATE: 'CHANNEL_CREATE',
  CHANNEL_POST: 'CHANNEL_POST'
});

// ============================================
// CRYPTO UTILITIES (Pure Functions)
// ============================================

async function sha256(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(length = 32) {
  const array = new Uint8Array(length / 2);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function timestamp() {
  return new Date().toISOString();
}

function timeString() {
  return new Date().toTimeString().slice(0, 8);
}

// ============================================
// URI PARSER (Pure)
// ============================================

function parseAddress(address) {
  if (!address || typeof address !== 'string') return null;
  
  const trimmed = address.trim();
  
  if (trimmed.startsWith('xhe://')) {
    return { scheme: URI_SCHEMES.XHE, hash: trimmed.slice(6) };
  }
  if (trimmed.startsWith('did:xhe:')) {
    return { scheme: URI_SCHEMES.DID_XHE, hash: trimmed.slice(8) };
  }
  if (trimmed.startsWith('pulse://')) {
    const rest = trimmed.slice(8);
    const parts = rest.split('/');
    return parts.length >= 2 
      ? { scheme: URI_SCHEMES.PULSE, sequence: parts[0], hash: parts.slice(1).join('/') }
      : { scheme: URI_SCHEMES.PULSE, hash: rest };
  }
  if (trimmed.startsWith('ipfs://')) {
    return { scheme: URI_SCHEMES.IPFS, hash: trimmed.slice(7) };
  }
  if (trimmed.startsWith('slip://')) {
    return { scheme: URI_SCHEMES.SLIP, hash: trimmed.slice(7) };
  }
  if (trimmed.startsWith('feed://')) {
    return { scheme: URI_SCHEMES.FEED, hash: trimmed.slice(7) };
  }
  if (trimmed.startsWith('channel://')) {
    return { scheme: URI_SCHEMES.CHANNEL, hash: trimmed.slice(10) };
  }
  
  return null;
}

// ============================================
// STORAGE LAYER (Kernel-Owned State)
// ============================================

const STORAGE_KEYS = Object.freeze({
  KERNEL_META: 'xhe_kernel_meta',
  IDENTITY: 'xhe_kernel_identity',
  IDENTITY_HISTORY: 'xhe_kernel_identity_history',
  CONTENT_STORE: 'xhe_kernel_content',
  PULSE_STORE: 'xhe_kernel_pulses',
  PULSE_SEQUENCE: 'xhe_kernel_pulse_seq',
  ADDRESS_INDEX: 'xhe_kernel_address_index',
  SLIP_LEDGER: 'xhe_kernel_slips',
  SOCIAL_GRAPH: 'xhe_kernel_social',
  FEEDS: 'xhe_kernel_feeds',
  CHANNELS: 'xhe_kernel_channels'
});

function loadState(key, defaultValue = null) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (e) {
    console.error('[KERNEL] Storage read error:', e);
    return defaultValue;
  }
}

function saveState(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('[KERNEL] Storage write error:', e);
  }
}

// ============================================
// XHE KERNEL CLASS
// ============================================

class XHEKernel {
  constructor() {
    this._listeners = {};
    this._initializeKernel();
  }

  // ============================================
  // KERNEL INITIALIZATION (Deterministic)
  // ============================================

  _initializeKernel() {
    // Load or create kernel metadata
    this.kernelMeta = loadState(STORAGE_KEYS.KERNEL_META, null);
    
    const isNewKernel = !this.kernelMeta;
    
    if (isNewKernel) {
      this.kernelMeta = {
        version: '1.0.0',
        created: timestamp(),
        lastActive: timestamp()
      };
      saveState(STORAGE_KEYS.KERNEL_META, this.kernelMeta);
    } else {
      this.kernelMeta.lastActive = timestamp();
      saveState(STORAGE_KEYS.KERNEL_META, this.kernelMeta);
    }

    // Load pulse sequence (MONOTONIC, PERSISTED)
    this._pulseSequence = loadState(STORAGE_KEYS.PULSE_SEQUENCE, 0);
    
    // Load identity (current and history)
    this.identity = this._loadOrCreateIdentity(isNewKernel);
    this.identityHistory = loadState(STORAGE_KEYS.IDENTITY_HISTORY, []);
    
    // Load kernel-owned stores
    this.contentStore = loadState(STORAGE_KEYS.CONTENT_STORE, {});
    this.pulseStore = loadState(STORAGE_KEYS.PULSE_STORE, {});
    this.addressIndex = loadState(STORAGE_KEYS.ADDRESS_INDEX, {});
    
    // Load economic layer (slips)
    this.slipLedger = loadState(STORAGE_KEYS.SLIP_LEDGER, {
      balances: {},
      transactions: []
    });
    
    // Ensure identity has genesis slips
    if (!this.slipLedger.balances[this.identity.did]) {
      this.slipLedger.balances[this.identity.did] = 100;
      saveState(STORAGE_KEYS.SLIP_LEDGER, this.slipLedger);
    }
    
    // Load social layer
    this.socialGraph = loadState(STORAGE_KEYS.SOCIAL_GRAPH, {
      following: [],
      followers: [],
      blocked: []
    });
    this.feeds = loadState(STORAGE_KEYS.FEEDS, {});
    this.channels = loadState(STORAGE_KEYS.CHANNELS, {});

    // Emit kernel init pulse (if new kernel)
    if (isNewKernel) {
      this._emitPulseSync(PULSE_TYPE.KERNEL_INIT, {
        version: this.kernelMeta.version,
        identity: this.identity.did
      });
    }
  }

  _loadOrCreateIdentity(isNewKernel) {
    const stored = loadState(STORAGE_KEYS.IDENTITY);
    if (stored && stored.did) {
      return stored;
    }
    return this._createIdentity(isNewKernel);
  }

  _createIdentity(emitPulse = true) {
    const id = randomHex(32);
    const identity = {
      did: `did:xhe:${id}`,
      publicKey: randomHex(64),
      created: timestamp(),
      version: 1
    };
    saveState(STORAGE_KEYS.IDENTITY, identity);
    
    // Initialize slip balance for new identity
    if (!this.slipLedger.balances[identity.did]) {
      this.slipLedger.balances[identity.did] = 100; // Genesis slips
      saveState(STORAGE_KEYS.SLIP_LEDGER, this.slipLedger);
    }
    
    if (emitPulse) {
      this._emitPulseSync(PULSE_TYPE.IDENTITY_CREATE, { did: identity.did });
    }
    
    return identity;
  }

  // ============================================
  // PULSE SYSTEM (Monotonic, Deterministic)
  // ============================================

  _getNextSequence() {
    this._pulseSequence++;
    saveState(STORAGE_KEYS.PULSE_SEQUENCE, this._pulseSequence);
    return String(this._pulseSequence).padStart(8, '0');
  }

  async _emitPulse(type, payload) {
    const sequence = this._getNextSequence();
    const ts = timestamp();
    
    const pulse = {
      type,
      payload,
      timestamp: ts,
      author: this.identity.did,
      sequence,
      kernelVersion: this.kernelMeta.version
    };

    const pulseContent = JSON.stringify(pulse);
    const hash = await sha256(pulseContent);
    
    const pulseId = `${sequence}/${hash}`;
    const address = `pulse://${pulseId}`;

    const storedPulse = {
      ...pulse,
      hash,
      address,
      id: pulseId
    };

    this.pulseStore[pulseId] = storedPulse;
    saveState(STORAGE_KEYS.PULSE_STORE, this.pulseStore);

    // Emit kernel event (console listens to this)
    this._emit('kernel:pulse', storedPulse);

    return { pulseId, address, pulse: storedPulse };
  }

  _emitPulseSync(type, payload) {
    // Synchronous version for init
    const sequence = this._getNextSequence();
    const ts = timestamp();
    
    const pulse = {
      type,
      payload,
      timestamp: ts,
      author: this.identity?.did || 'kernel',
      sequence,
      kernelVersion: this.kernelMeta?.version || '1.0.0'
    };

    const pulseContent = JSON.stringify(pulse);
    // Use simple hash for sync (will be replaced by proper hash on next async call)
    const hash = btoa(pulseContent).slice(0, 32);
    
    const pulseId = `${sequence}/${hash}`;
    
    if (!this.pulseStore) this.pulseStore = {};
    this.pulseStore[pulseId] = {
      ...pulse,
      hash,
      address: `pulse://${pulseId}`,
      id: pulseId
    };
    saveState(STORAGE_KEYS.PULSE_STORE, this.pulseStore);
  }

  // ============================================
  // IDENTITY (Kernel Authority)
  // ============================================

  getDID() {
    return this.identity.did;
  }

  getIdentity() {
    return { ...this.identity };
  }

  getIdentityHistory() {
    return [...this.identityHistory];
  }

  async regenerateIdentity() {
    // Archive current identity (maintains audit trail)
    this.identityHistory.push({
      ...this.identity,
      archivedAt: timestamp(),
      reason: 'USER_REGENERATE'
    });
    saveState(STORAGE_KEYS.IDENTITY_HISTORY, this.identityHistory);
    
    // Create new identity
    const oldDid = this.identity.did;
    this.identity = this._createIdentity(false);
    
    // Emit pulse (links old to new for auditability)
    await this._emitPulse(PULSE_TYPE.IDENTITY_REGENERATE, {
      oldDid,
      newDid: this.identity.did,
      historyLength: this.identityHistory.length
    });
    
    this._emit('kernel:identity:changed', {
      oldDid,
      newDid: this.identity.did,
      history: this.identityHistory
    });

    return this.getIdentity();
  }

  // ============================================
  // ADDRESS GENERATION (Kernel Authority ONLY)
  // ============================================

  async generateAddress(content, scheme = 'xhe', options = {}) {
    if (!content || typeof content !== 'string') {
      throw new Error('Content must be a non-empty string');
    }

    const hash = await sha256(content);
    const ts = timestamp();
    let address;

    switch (scheme) {
      case URI_SCHEMES.XHE:
        address = `xhe://${hash}`;
        break;
      case URI_SCHEMES.DID_XHE:
        address = `did:xhe:${hash.slice(0, 32)}`;
        break;
      case URI_SCHEMES.PULSE:
        const sequence = options.sequence || this._getNextSequence();
        address = `pulse://${sequence}/${hash}`;
        break;
      case URI_SCHEMES.IPFS:
        address = `ipfs://${hash}`;
        break;
      default:
        throw new Error(`Unknown scheme: ${scheme}`);
    }

    // Store in kernel content store (authoritative)
    this.contentStore[hash] = {
      content,
      timestamp: ts,
      author: this.identity.did,
      scheme
    };
    saveState(STORAGE_KEYS.CONTENT_STORE, this.contentStore);

    // Update address index (non-authoritative, derivable)
    this.addressIndex[address] = {
      hash,
      type: scheme,
      timestamp: ts,
      preview: content.slice(0, 50) + (content.length > 50 ? '...' : '')
    };
    saveState(STORAGE_KEYS.ADDRESS_INDEX, this.addressIndex);

    // Emit pulse
    const pulseResult = await this._emitPulse(PULSE_TYPE.ADDRESS_GENERATE, {
      address,
      scheme,
      hash: hash.slice(0, 16) + '...'
    });

    return { 
      address, 
      hash, 
      timestamp: ts,
      pulseId: pulseResult.pulseId
    };
  }

  // ============================================
  // ADDRESS RESOLUTION (Kernel Authority ONLY)
  // Returns structured truth states
  // ============================================

  async resolveAddress(address) {
    const parsed = parseAddress(address);
    
    if (!parsed) {
      return {
        state: RESOLUTION_STATE.INVALID,
        type: 'unknown',
        error: 'Malformed address format',
        address
      };
    }

    // Emit resolution attempt pulse
    await this._emitPulse(PULSE_TYPE.ADDRESS_RESOLVE, {
      address: address.slice(0, 40),
      scheme: parsed.scheme
    });

    // Resolution by scheme
    switch (parsed.scheme) {
      case URI_SCHEMES.XHE:
      case URI_SCHEMES.IPFS:
        return this._resolveContentAddress(address, parsed);
      
      case URI_SCHEMES.DID_XHE:
        return this._resolveIdentityAddress(address, parsed);
      
      case URI_SCHEMES.PULSE:
        return this._resolvePulseAddress(address, parsed);
      
      case URI_SCHEMES.SLIP:
        return this._resolveSlipAddress(address, parsed);
      
      case URI_SCHEMES.FEED:
        return this._resolveFeedAddress(address, parsed);
      
      case URI_SCHEMES.CHANNEL:
        return this._resolveChannelAddress(address, parsed);
      
      default:
        return {
          state: RESOLUTION_STATE.UNKNOWN,
          type: parsed.scheme,
          error: 'Unknown URI scheme',
          address
        };
    }
  }

  _resolveContentAddress(address, parsed) {
    // Check content store (authoritative)
    if (this.contentStore[parsed.hash]) {
      const entry = this.contentStore[parsed.hash];
      return {
        state: RESOLUTION_STATE.RESOLVED,
        type: parsed.scheme,
        content: entry.content,
        metadata: {
          timestamp: entry.timestamp,
          author: entry.author,
          scheme: entry.scheme
        },
        address
      };
    }

    // Check if known in index but content missing
    if (this.addressIndex[address]) {
      return {
        state: RESOLUTION_STATE.KNOWN_BUT_UNAVAILABLE,
        type: parsed.scheme,
        error: 'Address known but content not available locally',
        metadata: this.addressIndex[address],
        address
      };
    }

    return {
      state: RESOLUTION_STATE.UNKNOWN,
      type: parsed.scheme,
      error: 'Address not found in kernel state',
      address
    };
  }

  _resolveIdentityAddress(address, parsed) {
    // Check if it's our identity
    if (address === this.identity.did) {
      return {
        state: RESOLUTION_STATE.RESOLVED,
        type: 'did:xhe',
        content: JSON.stringify({
          did: this.identity.did,
          publicKey: this.identity.publicKey,
          created: this.identity.created,
          slipBalance: this.slipLedger.balances[this.identity.did] || 0
        }, null, 2),
        metadata: {
          isOwn: true,
          created: this.identity.created
        },
        address
      };
    }

    // Check identity history
    const historical = this.identityHistory.find(h => h.did === address);
    if (historical) {
      return {
        state: RESOLUTION_STATE.KNOWN_BUT_UNAVAILABLE,
        type: 'did:xhe',
        error: 'Historical identity (no longer active)',
        metadata: {
          archivedAt: historical.archivedAt,
          reason: historical.reason
        },
        address
      };
    }

    // Check if we know this DID from social graph
    const known = this.socialGraph.following.includes(address) || 
                  this.socialGraph.followers.includes(address);
    if (known) {
      return {
        state: RESOLUTION_STATE.KNOWN_BUT_UNAVAILABLE,
        type: 'did:xhe',
        error: 'Known identity but full data not available locally',
        address
      };
    }

    return {
      state: RESOLUTION_STATE.UNKNOWN,
      type: 'did:xhe',
      error: 'Identity not found in kernel state',
      address
    };
  }

  _resolvePulseAddress(address, parsed) {
    const pulseKey = parsed.sequence ? `${parsed.sequence}/${parsed.hash}` : parsed.hash;
    
    if (this.pulseStore[pulseKey]) {
      const pulse = this.pulseStore[pulseKey];
      return {
        state: RESOLUTION_STATE.RESOLVED,
        type: 'pulse',
        content: JSON.stringify(pulse, null, 2),
        metadata: {
          type: pulse.type,
          author: pulse.author,
          timestamp: pulse.timestamp,
          sequence: pulse.sequence
        },
        address
      };
    }

    return {
      state: RESOLUTION_STATE.UNKNOWN,
      type: 'pulse',
      error: 'Pulse not found in kernel state',
      address
    };
  }

  _resolveSlipAddress(address, parsed) {
    const tx = this.slipLedger.transactions.find(t => t.id === parsed.hash);
    if (tx) {
      return {
        state: RESOLUTION_STATE.RESOLVED,
        type: 'slip',
        content: JSON.stringify(tx, null, 2),
        metadata: tx,
        address
      };
    }

    return {
      state: RESOLUTION_STATE.UNKNOWN,
      type: 'slip',
      error: 'Slip transaction not found',
      address
    };
  }

  _resolveFeedAddress(address, parsed) {
    if (this.feeds[parsed.hash]) {
      return {
        state: RESOLUTION_STATE.RESOLVED,
        type: 'feed',
        content: JSON.stringify(this.feeds[parsed.hash], null, 2),
        metadata: this.feeds[parsed.hash],
        address
      };
    }

    return {
      state: RESOLUTION_STATE.UNKNOWN,
      type: 'feed',
      error: 'Feed not found',
      address
    };
  }

  _resolveChannelAddress(address, parsed) {
    if (this.channels[parsed.hash]) {
      return {
        state: RESOLUTION_STATE.RESOLVED,
        type: 'channel',
        content: JSON.stringify(this.channels[parsed.hash], null, 2),
        metadata: this.channels[parsed.hash],
        address
      };
    }

    return {
      state: RESOLUTION_STATE.UNKNOWN,
      type: 'channel',
      error: 'Channel not found',
      address
    };
  }

  // ============================================
  // ADDRESS INDEX (Non-Authoritative View)
  // ============================================

  getAddressIndex(filter = 'all') {
    const entries = Object.entries(this.addressIndex).map(([address, data]) => ({
      address,
      ...data
    }));

    if (filter === 'all') {
      return entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    return entries
      .filter(e => e.type === filter)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  clearAddressIndex() {
    // Only clears index, NOT kernel content store
    this.addressIndex = {};
    saveState(STORAGE_KEYS.ADDRESS_INDEX, this.addressIndex);
    this._emit('kernel:index:cleared');
  }

  // ============================================
  // SLIP SYSTEM (Economic Layer)
  // ============================================

  getSlipBalance(did = null) {
    const target = did || this.identity.did;
    return this.slipLedger.balances[target] || 0;
  }

  async mintSlips(amount, reason = 'GENESIS') {
    if (amount <= 0) throw new Error('Amount must be positive');
    
    const txId = randomHex(16);
    const tx = {
      id: txId,
      type: 'MINT',
      to: this.identity.did,
      amount,
      reason,
      timestamp: timestamp(),
      address: `slip://${txId}`
    };

    this.slipLedger.balances[this.identity.did] = 
      (this.slipLedger.balances[this.identity.did] || 0) + amount;
    this.slipLedger.transactions.push(tx);
    saveState(STORAGE_KEYS.SLIP_LEDGER, this.slipLedger);

    await this._emitPulse(PULSE_TYPE.SLIP_MINT, {
      amount,
      reason,
      newBalance: this.slipLedger.balances[this.identity.did]
    });

    return tx;
  }

  async transferSlips(toDid, amount, memo = '') {
    if (amount <= 0) throw new Error('Amount must be positive');
    
    const fromBalance = this.getSlipBalance();
    if (fromBalance < amount) {
      throw new Error(`Insufficient slips: have ${fromBalance}, need ${amount}`);
    }

    const txId = randomHex(16);
    const tx = {
      id: txId,
      type: 'TRANSFER',
      from: this.identity.did,
      to: toDid,
      amount,
      memo,
      timestamp: timestamp(),
      address: `slip://${txId}`
    };

    this.slipLedger.balances[this.identity.did] -= amount;
    this.slipLedger.balances[toDid] = (this.slipLedger.balances[toDid] || 0) + amount;
    this.slipLedger.transactions.push(tx);
    saveState(STORAGE_KEYS.SLIP_LEDGER, this.slipLedger);

    await this._emitPulse(PULSE_TYPE.SLIP_TRANSFER, {
      to: toDid.slice(0, 20) + '...',
      amount,
      memo
    });

    return tx;
  }

  getSlipHistory(limit = 50) {
    return this.slipLedger.transactions
      .filter(tx => tx.from === this.identity.did || tx.to === this.identity.did)
      .slice(-limit)
      .reverse();
  }

  // ============================================
  // SOCIAL SYSTEM (Feeds, Channels, Following)
  // ============================================

  async createPost(content, options = {}) {
    if (!content || typeof content !== 'string') {
      throw new Error('Post content required');
    }

    const hash = await sha256(content);
    const postId = randomHex(16);
    const ts = timestamp();

    const post = {
      id: postId,
      type: 'POST',
      content,
      hash,
      author: this.identity.did,
      timestamp: ts,
      replyTo: options.replyTo || null,
      repostOf: options.repostOf || null,
      channel: options.channel || null,
      address: `xhe://${hash}`
    };

    // Store content
    this.contentStore[hash] = {
      content,
      timestamp: ts,
      author: this.identity.did,
      scheme: 'xhe',
      postMeta: { id: postId, type: 'POST' }
    };
    saveState(STORAGE_KEYS.CONTENT_STORE, this.contentStore);

    // Add to personal feed
    const feedId = `personal_${this.identity.did.slice(8, 16)}`;
    if (!this.feeds[feedId]) {
      this.feeds[feedId] = {
        id: feedId,
        owner: this.identity.did,
        posts: [],
        created: ts
      };
    }
    this.feeds[feedId].posts.unshift(post);
    saveState(STORAGE_KEYS.FEEDS, this.feeds);

    // If channel specified, add there too
    if (options.channel && this.channels[options.channel]) {
      this.channels[options.channel].posts.unshift(post);
      saveState(STORAGE_KEYS.CHANNELS, this.channels);
    }

    // Emit pulse
    const pulseType = options.replyTo ? PULSE_TYPE.POST_REPLY : 
                      options.repostOf ? PULSE_TYPE.POST_REPOST : 
                      PULSE_TYPE.POST_CREATE;
    
    await this._emitPulse(pulseType, {
      postId,
      hash: hash.slice(0, 16),
      preview: content.slice(0, 50)
    });

    return post;
  }

  async createChannel(name, description = '') {
    const channelId = randomHex(12);
    const ts = timestamp();

    const channel = {
      id: channelId,
      name,
      description,
      owner: this.identity.did,
      created: ts,
      posts: [],
      members: [this.identity.did],
      address: `channel://${channelId}`
    };

    this.channels[channelId] = channel;
    saveState(STORAGE_KEYS.CHANNELS, this.channels);

    await this._emitPulse(PULSE_TYPE.CHANNEL_CREATE, {
      channelId,
      name
    });

    return channel;
  }

  getChannels() {
    return Object.values(this.channels);
  }

  getFeed(feedId = null) {
    if (feedId) {
      return this.feeds[feedId] || null;
    }
    // Return personal feed
    const personalFeedId = `personal_${this.identity.did.slice(8, 16)}`;
    return this.feeds[personalFeedId] || { posts: [] };
  }

  getGlobalFeed(limit = 50) {
    // Aggregate all posts from all feeds
    const allPosts = [];
    Object.values(this.feeds).forEach(feed => {
      allPosts.push(...feed.posts);
    });
    Object.values(this.channels).forEach(channel => {
      allPosts.push(...channel.posts);
    });

    // Dedupe by hash and sort
    const seen = new Set();
    return allPosts
      .filter(post => {
        if (seen.has(post.hash)) return false;
        seen.add(post.hash);
        return true;
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  async follow(did) {
    if (did === this.identity.did) throw new Error('Cannot follow self');
    if (this.socialGraph.following.includes(did)) return;
    if (this.socialGraph.blocked.includes(did)) {
      throw new Error('Cannot follow blocked identity');
    }

    this.socialGraph.following.push(did);
    saveState(STORAGE_KEYS.SOCIAL_GRAPH, this.socialGraph);

    await this._emitPulse(PULSE_TYPE.FOLLOW, { target: did });

    return this.socialGraph;
  }

  async unfollow(did) {
    this.socialGraph.following = this.socialGraph.following.filter(d => d !== did);
    saveState(STORAGE_KEYS.SOCIAL_GRAPH, this.socialGraph);

    await this._emitPulse(PULSE_TYPE.UNFOLLOW, { target: did });

    return this.socialGraph;
  }

  getSocialGraph() {
    return { ...this.socialGraph };
  }

  // ============================================
  // STATS (Computed, Not Stored)
  // ============================================

  getStats() {
    return {
      pulseCount: Object.keys(this.pulseStore).length,
      addressCount: Object.keys(this.addressIndex).length,
      contentCount: Object.keys(this.contentStore).length,
      slipBalance: this.getSlipBalance(),
      following: this.socialGraph.following.length,
      postCount: this.getFeed()?.posts?.length || 0,
      channelCount: Object.keys(this.channels).length,
      currentSequence: this._pulseSequence
    };
  }

  // ============================================
  // EXPORT / IMPORT (Full Kernel State)
  // ============================================

  exportKernelState() {
    return JSON.stringify({
      version: 2,
      exported: timestamp(),
      kernelMeta: this.kernelMeta,
      identity: this.identity,
      identityHistory: this.identityHistory,
      pulseSequence: this._pulseSequence,
      contentStore: this.contentStore,
      pulseStore: this.pulseStore,
      addressIndex: this.addressIndex,
      slipLedger: this.slipLedger,
      socialGraph: this.socialGraph,
      feeds: this.feeds,
      channels: this.channels
    }, null, 2);
  }

  importKernelState(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      
      if (data.version !== 2) {
        // Handle v1 migration
        if (data.entries) {
          // Old format - just merge address index
          Object.assign(this.addressIndex, data.entries);
          saveState(STORAGE_KEYS.ADDRESS_INDEX, this.addressIndex);
          return { imported: Object.keys(data.entries).length, migrated: true };
        }
      }

      // Full state import
      let imported = 0;

      if (data.contentStore) {
        Object.entries(data.contentStore).forEach(([hash, content]) => {
          if (!this.contentStore[hash]) {
            this.contentStore[hash] = content;
            imported++;
          }
        });
        saveState(STORAGE_KEYS.CONTENT_STORE, this.contentStore);
      }

      if (data.addressIndex) {
        Object.entries(data.addressIndex).forEach(([addr, entry]) => {
          if (!this.addressIndex[addr]) {
            this.addressIndex[addr] = entry;
          }
        });
        saveState(STORAGE_KEYS.ADDRESS_INDEX, this.addressIndex);
      }

      if (data.pulseStore) {
        Object.entries(data.pulseStore).forEach(([id, pulse]) => {
          if (!this.pulseStore[id]) {
            this.pulseStore[id] = pulse;
          }
        });
        saveState(STORAGE_KEYS.PULSE_STORE, this.pulseStore);
      }

      return { imported, errors: [] };
    } catch (e) {
      return { imported: 0, errors: [e.message] };
    }
  }

  // ============================================
  // KERNEL RESET (Explicit, Auditable)
  // ============================================

  async resetKernel(preserveIdentity = false) {
    // Emit reset pulse before wiping
    await this._emitPulse(PULSE_TYPE.KERNEL_RESET, {
      preserveIdentity,
      timestamp: timestamp()
    });

    // Clear all kernel state
    Object.values(STORAGE_KEYS).forEach(key => {
      if (preserveIdentity && (key === STORAGE_KEYS.IDENTITY || key === STORAGE_KEYS.IDENTITY_HISTORY)) {
        return;
      }
      localStorage.removeItem(key);
    });

    // Reinitialize
    this._pulseSequence = 0;
    this.contentStore = {};
    this.pulseStore = {};
    this.addressIndex = {};
    this.slipLedger = { balances: {}, transactions: [] };
    this.socialGraph = { following: [], followers: [], blocked: [] };
    this.feeds = {};
    this.channels = {};

    if (!preserveIdentity) {
      this.identityHistory = [];
      this.identity = this._createIdentity(false);
    }

    this._emit('kernel:reset', { preserveIdentity });
  }

  // ============================================
  // EVENT SYSTEM (Kernel -> UI Communication)
  // ============================================

  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
  }

  off(event, callback) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    }
  }

  _emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[KERNEL] Event handler error for ${event}:`, e);
        }
      });
    }
  }
}

// ============================================
// SINGLETON
// ============================================

const xheKernel = new XHEKernel();

export { 
  xheKernel, 
  XHEKernel, 
  parseAddress, 
  URI_SCHEMES, 
  RESOLUTION_STATE, 
  PULSE_TYPE,
  timeString 
};

if (typeof window !== 'undefined') {
  window.xheKernel = xheKernel;
}
