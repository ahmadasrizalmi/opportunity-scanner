// Opportunity Scanner — Background Service Worker

// ─── History Management ──────────────────────────────────────────

async function getHistory() {
  const data = await chrome.storage.local.get('scanHistory');
  return data.scanHistory || [];
}

async function addToHistory(result) {
  const history = await getHistory();
  
  // Check if already exists (update score if so)
  const existing = history.findIndex(h => h.hostname === result.hostname);
  if (existing >= 0) {
    history[existing] = { ...history[existing], ...result, updatedAt: new Date().toISOString() };
  } else {
    history.unshift(result);
  }
  
  // Keep last 200
  if (history.length > 200) history.length = 200;
  
  await chrome.storage.local.set({ scanHistory: history });
}

async function clearHistory() {
  await chrome.storage.local.set({ scanHistory: [] });
}

// ─── Message Handler ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  
  if (msg.type === 'GET_HISTORY') {
    (async () => {
      const history = await getHistory();
      sendResponse({ success: true, history });
    })();
    return true;
  }
  
  if (msg.type === 'ADD_TO_HISTORY') {
    (async () => {
      await addToHistory(msg.result);
      sendResponse({ success: true });
    })();
    return true;
  }
  
  if (msg.type === 'CLEAR_HISTORY') {
    (async () => {
      await clearHistory();
      sendResponse({ success: true });
    })();
    return true;
  }
  
  if (msg.type === 'EXPORT_HISTORY') {
    (async () => {
      const history = await getHistory();
      const csv = [
        'Hostname,Title,Score,Images,Date',
        ...history.map(h => 
          `"${h.hostname}","${(h.title||'').replace(/"/g,'""')}",${h.score},${h.imageCount||0},${h.date}`
        )
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url,
        filename: `opportunity-scan-${new Date().toISOString().split('T')[0]}.csv`,
        saveAs: true
      }, () => {
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        sendResponse({ success: true });
      });
    })();
    return true;
  }
  
  return true;
});

// ─── Open Side Panel ──────────────────────────────────────────────

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

console.log('[Opportunity Scanner] Background loaded');
