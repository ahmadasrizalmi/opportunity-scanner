// Opportunity Scanner — Side Panel Logic

const $ = id => document.getElementById(id);

// ─── Init ──────────────────────────────────────────────────────────

async function init() {
  setupEvents();
  loadHistory();
  
  // Auto-scan if opened from a tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && !tab.url?.startsWith('chrome://') && !tab.url?.startsWith('chrome-extension://')) {
    // Show scan button ready state
  }
}

// ─── Scan ──────────────────────────────────────────────────────────

async function scanCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) {
    toast('Tidak ada tab aktif');
    return;
  }
  
  if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
    toast('Tidak bisa scan halaman Chrome');
    return;
  }
  
  $('scan-loading').classList.add('visible');
  $('score-card').classList.remove('visible');
  
  try {
    // Try to inject content script if not already there
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (e) {
      // Script might already be injected or no permission
    }
    
    // Send scan message
    chrome.tabs.sendMessage(tab.id, { type: 'SCAN_PAGE' }, (response) => {
      $('scan-loading').classList.remove('visible');
      
      if (chrome.runtime.lastError) {
        // Fallback: scan from background
        scanFromBackground(tab);
        return;
      }
      
      if (response?.success) {
        renderScore(response.result);
        
        // Save to history
        chrome.runtime.sendMessage({ type: 'SCAN_COMPLETE', result: response.result });
      } else {
        toast(response?.error || 'Gagal scan halaman');
      }
    });
  } catch (e) {
    $('scan-loading').classList.remove('visible');
    toast('Error: ' + e.message);
  }
}

async function scanFromBackground(tab) {
  // Fallback: inject and scan in one shot
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Inline scan logic
        const images = document.querySelectorAll('img');
        let totalImages = 0;
        let phoneImages = 0;
        let lowRes = 0;
        let highRes = 0;
        let stockPhotos = 0;
        let uniquePhotos = 0;
        
        for (const img of images) {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (w < 50 || h < 50) continue;
          
          const src = img.src || '';
          if (src.startsWith('data:image/svg')) continue;
          
          totalImages++;
          
          const totalPixels = w * h;
          if (totalPixels < 800000) lowRes++;
          else if (totalPixels >= 2000000) highRes++;
          
          const aspectRatio = w / h;
          if ((aspectRatio > 0.4 && aspectRatio < 0.75)) phoneImages++;
          
          const isStock = src.includes('shutterstock') || src.includes('unsplash') || src.includes('pexels') || src.includes('getty');
          if (isStock) stockPhotos++;
          else uniquePhotos++;
        }
        
        const hasGallery = !!(
          document.querySelector('[class*="gallery"]') ||
          document.querySelector('[class*="portfolio"]') ||
          document.querySelector('[class*="slider"]') ||
          document.querySelector('[class*="carousel"]')
        );
        
        const hasBooking = !!(
          document.querySelector('[class*="booking"]') ||
          document.querySelector('[class*="reserv"]') ||
          document.querySelector('a[href*="booking"]') ||
          document.querySelector('a[href*="wa.me"]')
        );
        
        const socialLinks = [];
        document.querySelectorAll('a[href]').forEach(a => {
          if (a.href.includes('instagram.com')) socialLinks.push('instagram');
          if (a.href.includes('facebook.com')) socialLinks.push('facebook');
          if (a.href.includes('tiktok.com')) socialLinks.push('tiktok');
        });
        
        // Score
        let score = 50;
        if (uniquePhotos === 0) score += 30;
        else if (uniquePhotos <= 3) score += 20;
        else if (uniquePhotos <= 6) score += 10;
        else if (uniquePhotos > 15) score -= 15;
        if (phoneImages > 0 && phoneImages / totalImages > 0.5) score += 15;
        if (lowRes > 0 && lowRes / totalImages > 0.5) score += 10;
        if (hasGallery && uniquePhotos <= 6) score += 10;
        if (hasBooking && uniquePhotos <= 6) score += 15;
        if (socialLinks.length > 0) score += 5;
        if (totalImages === 0) score = 95;
        if (stockPhotos > uniquePhotos && stockPhotos > 2) score += 15;
        score = Math.max(0, Math.min(100, score));
        
        let category;
        if (score >= 80) category = 'very-high';
        else if (score >= 60) category = 'high';
        else if (score >= 40) category = 'medium';
        else category = 'low';
        
        // Business type
        const pageText = document.body.innerText.toLowerCase();
        let businessType = 'unknown';
        if (pageText.includes('villa') || pageText.includes('resort')) businessType = 'villa-resort';
        else if (pageText.includes('hotel')) businessType = 'hotel';
        else if (pageText.includes('homestay') || pageText.includes('guest house')) businessType = 'homestay';
        else if (pageText.includes('cafe') || pageText.includes('coffee')) businessType = 'cafe';
        else if (pageText.includes('restaurant') || pageText.includes('restoran')) businessType = 'restaurant';
        else if (pageText.includes('kos') || pageText.includes('kost')) businessType = 'kos';
        
        return {
          url: window.location.href,
          hostname: window.location.hostname,
          title: document.title,
          timestamp: new Date().toISOString(),
          stats: { totalImages, uniquePhotos, phoneImages, lowRes, highRes, stockPhotos },
          features: { hasGallery, hasBooking, socialLinks: [...new Set(socialLinks)] },
          businessType,
          score,
          category,
          images: []
        };
      }
    });
    
    if (result?.result) {
      renderScore(result.result);
      chrome.runtime.sendMessage({ type: 'SCAN_COMPLETE', result: result.result });
    }
  } catch (e) {
    toast('Error: ' + e.message);
  }
}

// ─── Render Score ──────────────────────────────────────────────────

function renderScore(data) {
  const { score, category, hostname, stats, features, businessType } = data;
  
  $('score-card').classList.add('visible');
  $('score-url').textContent = hostname;
  
  // Score number with animation
  const numberEl = $('score-number');
  numberEl.className = `score-number ${category}`;
  numberEl.textContent = '0';
  animateNumber(numberEl, 0, score, 600);
  
  // Badge
  const badgeEl = $('score-badge');
  const labels = {
    'very-high': 'Sangat Butuh',
    'high': 'Butuh',
    'medium': 'Potensial',
    'low': 'Sudah Bagus'
  };
  badgeEl.className = `score-badge ${category}`;
  badgeEl.textContent = labels[category];
  
  // Score bar
  const barFill = $('score-bar-fill');
  barFill.className = `score-bar-fill ${category}`;
  barFill.style.width = '0%';
  setTimeout(() => { barFill.style.width = `${score}%`; }, 100);
  
  // Stats grid
  $('stats-grid').innerHTML = `
    <div class="stat-item">
      <div class="stat-number">${stats.totalImages}</div>
      <div class="stat-label">Total Foto</div>
    </div>
    <div class="stat-item">
      <div class="stat-number">${stats.uniquePhotos}</div>
      <div class="stat-label">Foto Asli</div>
    </div>
    <div class="stat-item">
      <div class="stat-number">${stats.lowRes}</div>
      <div class="stat-label">Low Res</div>
    </div>
  `;
  
  // Details
  const details = [
    { label: 'Jenis Bisnis', value: businessType.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()) },
    { label: 'Foto HP', value: stats.phoneImages > 0 ? `${stats.phoneImages} foto` : 'Tidak ada', badge: stats.phoneImages > 0 ? 'bad' : null },
    { label: 'Foto Stock', value: stats.stockPhotos > 0 ? `${stats.stockPhotos} foto` : 'Tidak ada', badge: stats.stockPhotos > 0 ? 'bad' : null },
    { label: 'Gallery/Portfolio', value: features.hasGallery ? 'Ada' : 'Tidak ada', badge: features.hasGallery ? (stats.uniquePhotos <= 6 ? 'bad' : 'good') : null },
    { label: 'Booking/Reservasi', value: features.hasBooking ? 'Ada' : 'Tidak ada', badge: features.hasBooking ? (stats.uniquePhotos <= 6 ? 'bad' : 'good') : null },
    { label: 'Social Media', value: features.socialLinks.length > 0 ? features.socialLinks.join(', ') : 'Tidak ada' }
  ];
  
  $('detail-list').innerHTML = details.map(d => `
    <div class="detail-row">
      <span class="detail-label">${d.label}</span>
      <span class="detail-value${d.badge === 'bad' ? ' badge-yes' : d.badge === 'good' ? ' badge-no' : ''}">${d.value}</span>
    </div>
  `).join('');
}

function animateNumber(el, from, to, duration) {
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ─── History ───────────────────────────────────────────────────────

function loadHistory() {
  chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (resp) => {
    if (resp?.success) {
      renderHistory(resp.history);
    }
  });
}

function renderHistory(history) {
  const list = $('history-list');
  
  if (!history || history.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        <div class="empty-state-text">Belum ada riwayat scan</div>
      </div>
    `;
    return;
  }
  
  list.innerHTML = history.map(h => `
    <div class="history-item" data-url="${esc(h.url || '')}" data-hostname="${esc(h.hostname || '')}">
      <div class="history-score ${h.category}">${h.score}</div>
      <div class="history-info">
        <div class="history-name">${esc(h.title || h.hostname || 'Unknown')}</div>
        <div class="history-meta">${h.stats?.uniquePhotos || 0} foto • ${h.businessType || 'unknown'} • ${formatDate(h.timestamp || h.updatedAt)}</div>
      </div>
      <button class="history-delete" data-hostname="${esc(h.hostname || '')}" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
  `).join('');
  
  // Click to view details
  list.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.history-delete')) return;
      // Could open the URL in a new tab
      const url = item.dataset.url;
      if (url) window.open(url, '_blank');
    });
  });
  
  // Delete buttons
  list.querySelectorAll('.history-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hostname = btn.dataset.hostname;
      chrome.runtime.sendMessage({ type: 'DELETE_SCAN', hostname }, () => {
        loadHistory();
        toast('Dihapus');
      });
    });
  });
}

// ─── Export ────────────────────────────────────────────────────────

function exportCSV() {
  chrome.runtime.sendMessage({ type: 'EXPORT_CSV' }, (resp) => {
    if (resp?.success) {
      const blob = new Blob([resp.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opportunity_scan_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast('CSV exported');
    }
  });
}

function clearAll() {
  if (confirm('Hapus semua riwayat?')) {
    chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' }, () => {
      loadHistory();
      toast('Riwayat dihapus');
    });
  }
}

// ─── UI Helpers ────────────────────────────────────────────────────

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  
  if (diff < 60000) return 'Baru saja';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m lalu`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}j lalu`;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// ─── Events ────────────────────────────────────────────────────────

function setupEvents() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(`panel-${tab.dataset.tab}`).classList.add('active');
      
      if (tab.dataset.tab === 'history') loadHistory();
    });
  });
  
  // Scan
  $('btn-scan').addEventListener('click', scanCurrentPage);
  
  // History actions
  $('btn-export-all').addEventListener('click', exportCSV);
  $('btn-clear-all').addEventListener('click', clearAll);
  
  // Export from header
  $('btn-export').addEventListener('click', exportCSV);
}

// ─── Start ─────────────────────────────────────────────────────────

init();
