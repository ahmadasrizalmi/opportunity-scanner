// Opportunity Scanner — Content Script
// Scans images on the current page and analyzes quality

(function() {
  'use strict';
  
  // Prevent double injection
  if (window.__oppScannerInjected) return;
  window.__oppScannerInjected = true;
  
  // ─── Image Scanner ─────────────────────────────────────────────
  
  function scanPageImages() {
    const images = document.querySelectorAll('img');
    const results = [];
    
    for (const img of images) {
      // Skip tiny images (icons, pixels, tracking)
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w < 50 || h < 50) continue;
      
      // Skip SVGs and data URIs (unless they're meaningful)
      const src = img.src || '';
      if (src.startsWith('data:image/svg')) continue;
      if (src.includes('logo') && w < 200) continue;
      if (src.includes('icon') && w < 100) continue;
      if (src.includes('pixel') || src.includes('tracking') || src.includes('beacon')) continue;
      
      // Skip favicon
      if (img.rel === 'icon' || img.getAttribute('rel') === 'shortcut icon') continue;
      
      // Analyze
      const analysis = analyzeImage(img, w, h);
      results.push(analysis);
    }
    
    return results;
  }
  
  function analyzeImage(img, w, h) {
    const src = img.src || '';
    const alt = img.alt || '';
    const title = img.title || '';
    
    // Aspect ratio
    const aspectRatio = w / h;
    
    // Is it a typical phone photo? (usually taller, 3:4 or 9:16)
    const isPhoneAspect = (aspectRatio > 0.4 && aspectRatio < 0.75);
    
    // Is it a proper landscape photo? (3:2 or 16:9)
    const isProperLandscape = (aspectRatio > 1.4 && aspectRatio < 1.9);
    
    // Is it square? (1:1)
    const isSquare = (aspectRatio > 0.9 && aspectRatio < 1.1);
    
    // Resolution quality
    const totalPixels = w * h;
    let resolutionScore;
    if (totalPixels >= 2000000) resolutionScore = 'high';        // 2MP+
    else if (totalPixels >= 800000) resolutionScore = 'medium';   // 800K+
    else resolutionScore = 'low';                                  // <800K
    
    // Image URL patterns (phone photos often have these)
    const isLikelyPhone = (
      src.includes('IMG_') ||
      src.includes('IMG-') ||
      src.includes('photo-') ||
      src.includes('DCIM') ||
      src.includes('whatsapp') ||
      src.includes('fbcdn') ||
      src.includes('scontent')
    );
    
    // Stock photo patterns
    const isStockPhoto = (
      src.includes('shutterstock') ||
      src.includes('unsplash') ||
      src.includes('pexels') ||
      src.includes('getty') ||
      src.includes('istock') ||
      src.includes('stock')
    );
    
    // Get natural dimensions from src (if image not loaded yet)
    let effectiveW = w;
    let effectiveH = h;
    const sizeMatch = src.match(/(\d+)x(\d+)/);
    if (sizeMatch && !w) {
      effectiveW = parseInt(sizeMatch[1]);
      effectiveH = parseInt(sizeMatch[2]);
    }
    
    return {
      src: src.substring(0, 200),
      alt: alt.substring(0, 100),
      width: effectiveW,
      height: effectiveH,
      aspectRatio: Math.round(aspectRatio * 100) / 100,
      resolutionScore,
      isPhoneAspect,
      isProperLandscape,
      isSquare,
      isLikelyPhone,
      isStockPhoto
    };
  }
  
  // ─── Page Analysis ─────────────────────────────────────────────
  
  function analyzePage() {
    const images = scanPageImages();
    const url = window.location.href;
    const hostname = window.location.hostname;
    const title = document.title;
    
    // Page stats
    const totalImages = images.length;
    const phoneImages = images.filter(i => i.isLikelyPhone || i.isPhoneAspect).length;
    const proImages = images.filter(i => i.isProperLandscape).length;
    const lowRes = images.filter(i => i.resolutionScore === 'low').length;
    const highRes = images.filter(i => i.resolutionScore === 'high').length;
    const stockPhotos = images.filter(i => i.isStockPhoto).length;
    const uniquePhotos = totalImages - stockPhotos;
    
    // Check for gallery/portfolio sections
    const hasGallery = !!(
      document.querySelector('[class*="gallery"]') ||
      document.querySelector('[class*="portfolio"]') ||
      document.querySelector('[class*="slider"]') ||
      document.querySelector('[class*="carousel"]') ||
      document.querySelector('[class*="swiper"]')
    );
    
    // Check for booking/contact
    const hasBooking = !!(
      document.querySelector('[class*="booking"]') ||
      document.querySelector('[class*="reserv"]') ||
      document.querySelector('[class*="order"]') ||
      document.querySelector('a[href*="booking"]') ||
      document.querySelector('a[href*="reservation"]') ||
      document.querySelector('a[href*="wa.me"]') ||
      document.querySelector('a[href*="api.whatsapp"]')
    );
    
    // Check for social media links
    const socialLinks = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const href = a.href;
      if (href.includes('instagram.com')) socialLinks.push('instagram');
      if (href.includes('facebook.com')) socialLinks.push('facebook');
      if (href.includes('tiktok.com')) socialLinks.push('tiktok');
      if (href.includes('youtube.com')) socialLinks.push('youtube');
      if (href.includes('twitter.com') || href.includes('x.com')) socialLinks.push('twitter');
    });
    
    // Calculate opportunity score (0-100, higher = more opportunity)
    let score = 50; // base
    
    // Fewer unique photos = more opportunity
    if (uniquePhotos === 0) score += 30;
    else if (uniquePhotos <= 3) score += 20;
    else if (uniquePhotos <= 6) score += 10;
    else if (uniquePhotos > 15) score -= 15;
    
    // Phone photos = high opportunity
    if (phoneImages > 0 && phoneImages / totalImages > 0.5) score += 15;
    
    // Low resolution = high opportunity
    if (lowRes > 0 && lowRes / totalImages > 0.5) score += 10;
    
    // No professional landscape photos = opportunity
    if (proImages === 0 && totalImages > 0) score += 10;
    
    // Has gallery but bad photos = opportunity
    if (hasGallery && uniquePhotos <= 6) score += 10;
    
    // Has booking but bad photos = GREAT opportunity (they care about conversion)
    if (hasBooking && (uniquePhotos <= 6 || lowRes > totalImages * 0.5)) score += 15;
    
    // Has social media = active business, more likely to invest
    if (socialLinks.length > 0) score += 5;
    
    // No photos at all = very high opportunity
    if (totalImages === 0) score = 95;
    
    // Stock photos instead of real photos = opportunity
    if (stockPhotos > uniquePhotos && stockPhotos > 2) score += 15;
    
    // Cap score
    score = Math.max(0, Math.min(100, score));
    
    // Determine category
    let category;
    if (score >= 80) category = 'very-high';
    else if (score >= 60) category = 'high';
    else if (score >= 40) category = 'medium';
    else category = 'low';
    
    // Business type detection
    const pageText = document.body.innerText.toLowerCase();
    let businessType = 'unknown';
    if (pageText.includes('villa') || pageText.includes('resort')) businessType = 'villa-resort';
    else if (pageText.includes('hotel') || pageText.includes('motel')) businessType = 'hotel';
    else if (pageText.includes('homestay') || pageText.includes('guest house')) businessType = 'homestay';
    else if (pageText.includes('cafe') || pageText.includes('coffee')) businessType = 'cafe';
    else if (pageText.includes('restaurant') || pageText.includes('restoran') || pageText.includes('rumah makan')) businessType = 'restaurant';
    else if (pageText.includes('kos') || pageText.includes('kost')) businessType = 'kos';
    else if (pageText.includes('coworking') || pageText.includes('office')) businessType = 'coworking';
    else if (pageText.includes('apartemen') || pageText.includes('apartment')) businessType = 'apartment';
    else if (pageText.includes('spa') || pageText.includes('salon') || pageText.includes('kecantikan')) businessType = 'spa-salon';
    
    return {
      url,
      hostname,
      title,
      timestamp: new Date().toISOString(),
      stats: {
        totalImages,
        uniquePhotos,
        phoneImages,
        proImages,
        lowRes,
        highRes,
        stockPhotos
      },
      features: {
        hasGallery,
        hasBooking,
        socialLinks: [...new Set(socialLinks)]
      },
      businessType,
      score,
      category,
      images: images.slice(0, 20) // limit for storage
    };
  }
  
  // ─── Message Handler ───────────────────────────────────────────
  
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'SCAN_PAGE') {
      try {
        const result = analyzePage();
        sendResponse({ success: true, result });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    }
    return true;
  });
  
  console.log('[Opportunity Scanner] Content script loaded');
})();
