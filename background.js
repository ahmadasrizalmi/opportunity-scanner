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

async function deleteFromHistory(hostname) {
  const history = await getHistory();
  const filtered = history.filter(h => h.hostname !== hostname);
  await chrome.storage.local.set({ scanHistory: filtered });
}

// ─── CSV Export ──────────────────────────────────────────────────

function exportToCSV(history) {
  const headers = ['URL', 'Business Type', 'Score', 'Total Images', 'Phone Photos', 'Low Res', 'Stock Photos', 'Has Gallery', 'Has Booking', 'Social Links', 'Scanned At'];
  const rows = history.map(h => [
    h.url,
    h.businessType,
    h.score,
    h.stats?.totalImages || 0,
    h.stats?.phoneImages || 0,
    h.stats?.lowRes || 0,
    h.stats?.stockPhotos || 0,
    h.features?.hasGallery ? 'Yes' : 'No',
    h.features?.hasBooking ? 'Yes' : 'No',
    (h.features?.socialLinks || []).join('; '),
    h.timestamp || h.updatedAt || ''
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  
  return [headers.join(','), ...rows].join('\n');
}

// ─── Message Handler ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  
  if (msg.type === 'SCAN_COMPLETE') {
    (async () => {
      await addToHistory(msg.result);
      sendResponse({ success: true });
    })();
    return true;
  }
  
  if (msg.type === 'GET_HISTORY') {
    (async () => {
      const history = await getHistory();
      sendResponse({ success: true, history });
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
  
  if (msg.type === 'DELETE_SCAN') {
    (async () => {
      await deleteFromHistory(msg.hostname);
      sendResponse({ success: true });
    })();
    return true;
  }
  
  if (msg.type === 'EXPORT_CSV') {
    (async () => {
      const history = await getHistory();
      const csv = exportToCSV(history);
      sendResponse({ success: true, csv });
    })();
    return true;
  }
});

// ─── Open Side Panel ──────────────────────────────────────────────

chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

console.log('[Opportunity Scanner] Background loaded');
