/* ===== SG PRIME LIVING — MAIN JS v2 ===== */

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTZ8KY6CePMOc3xOuj9UYlkmVCckiQkv9gB4EmlQXS0BteEN4LNEeVtUyBHC47ctJCJTxhS-repQvhS/pub?output=csv';
const CORS_PROXY   = 'https://corsproxy.io/?url=';
const BLOG_SHEET_URL  = SHEET_CSV_URL.replace('pub?output=csv','pub?gid=1&output=csv'); // Blog tab (gid=1)
const VLOG_SHEET_URL  = SHEET_CSV_URL.replace('pub?output=csv','pub?gid=2&output=csv'); // Vlog tab (gid=2)
const MESSENGER_URL   = 'https://m.me/SGPrimeLiving';
const FACEBOOK_URL    = 'https://www.facebook.com/SGPrimeLiving';
const FEATURED_LIMIT  = 3; // max on homepage

// ─── STATE ────────────────────────────────────────────────
let allProperties = [];
let filteredProperties = [];
let sheetHeaders = [];   // dynamic headers from sheet
let currentModalMedia = [];
let currentMediaIndex = 0;
let chatHistory = [];

// ════════════════════════════════════════════════
//  CSV PARSING — robust, handles multiline quoted fields
// ════════════════════════════════════════════════
function parseCSV(raw) {
  // Normalize line endings
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let cur = '', row = [], inQ = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], nx = text[i + 1];
    if (inQ) {
      if (ch === '"' && nx === '"') { cur += '"'; i++; }         // escaped quote
      else if (ch === '"')          { inQ = false; }             // end quote
      else                          { cur += ch; }
    } else {
      if      (ch === '"')  { inQ = true; }
      else if (ch === ',')  { row.push(cur.trim()); cur = ''; }
      else if (ch === '\n') { row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
      else                  { cur += ch; }
    }
  }
  // last cell / row
  if (cur || row.length) { row.push(cur.trim()); rows.push(row); }

  if (rows.length < 2) return { headers: [], data: [] };

  const headers = rows[0].map(h => h.replace(/^"|"$/g, '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));

  const data = rows.slice(1)
    .filter(r => r.some(c => c.trim()))  // skip blank rows
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (r[i] || '').replace(/^"|"$/g, '').trim();
      });
      return obj;
    });

  return { headers, data };
}

// ════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════
function formatPrice(raw) {
  if (!raw) return 'Contact for Price';
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return raw;
  if (n >= 1_000_000) return '₱' + (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return '₱' + (n / 1_000).toFixed(0) + 'K';
  return '₱' + n.toLocaleString();
}

/** Convert any Google Drive share URL to a direct-display URL */
function driveUrl(url) {
  if (!url) return '';
  url = url.trim();

  // Already a uc?export link — return as-is
  if (url.includes('drive.google.com/uc')) return url;

  // /file/d/ID/view  or  /open?id=ID
  const fileMatch = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  const id = (fileMatch && fileMatch[1]) || (openMatch && openMatch[1]);

  if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
  return url;
}

/** Convert any Google Drive video share URL to embeddable URL */
function driveVideoEmbed(url) {
  if (!url) return '';
  url = url.trim();
  const fileMatch = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  const id = (fileMatch && fileMatch[1]) || (openMatch && openMatch[1]);
  if (id) return `https://drive.google.com/file/d/${id}/preview`;
  return url;
}

function isVideo(url) {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov)/i.test(url)
    || url.includes('youtube.com')
    || url.includes('youtu.be')
    || (url.includes('drive.google.com') && (url.includes('/file/') || url.includes('export=view') || url.includes('preview')));
}

function isDriveVideo(url) {
  return url && url.includes('drive.google.com');
}

function youtubeEmbed(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : url;
}

/** Get processed media URL ready for display */
function mediaUrl(url, forVideo = false) {
  if (!url) return '';
  if (url.includes('drive.google.com')) {
    return forVideo ? driveVideoEmbed(url) : driveUrl(url);
  }
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return youtubeEmbed(url);
  }
  return url;
}

/** Safely get first truthy value from property by multiple key variants */
function prop(p, ...keys) {
  for (const k of keys) {
    if (p[k] && p[k].trim()) return p[k].trim();
  }
  return '';
}

/** Truncate text for card preview */
function truncate(str, max = 120) {
  if (!str) return '';
  const clean = str.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max).trimEnd() + '…' : clean;
}

/** Collect all media URLs from a property row (images + videos) */
function collectMedia(p) {
  const items = [];
  // Named image fields
  ['image','image_url','photo','thumbnail','photo_1','image_1'].forEach(k => {
    if (p[k]) items.push({ url: p[k], type: 'image' });
  });
  // image2..image10, photo2..photo10
  for (let i = 2; i <= 10; i++) {
    ['image'+i, 'photo_'+i, 'image_'+i].forEach(k => {
      if (p[k]) items.push({ url: p[k], type: 'image' });
    });
  }
  // Dynamic extra image columns (any header with "image" or "photo")
  sheetHeaders.forEach(h => {
    if (/(image|photo)\d+/.test(h) && !items.find(m => m.url === p[h]) && p[h]) {
      items.push({ url: p[h], type: 'image' });
    }
  });
  // Deduplicate
  const seen = new Set();
  return items.filter(m => {
    if (!m.url || seen.has(m.url)) return false;
    seen.add(m.url);
    return true;
  });
}

/** Collect video items */
function collectVideos(p) {
  const items = [];
  ['video','video_url','youtube','video_1','vlog'].forEach(k => {
    if (p[k]) items.push(p[k]);
  });
  for (let i = 2; i <= 5; i++) {
    ['video'+i,'video_'+i].forEach(k => { if (p[k]) items.push(p[k]); });
  }
  return [...new Set(items.filter(Boolean))];
}

// ════════════════════════════════════════════════
//  FETCH
// ════════════════════════════════════════════════
async function fetchCSV(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.trimStart().startsWith('<')) throw new Error('Got HTML — possible CORS block or sheet not published');
  return text;
}

async function loadCSV(url) {
  try { return await fetchCSV(url); }
  catch (e) {
    console.warn('Direct fetch failed, trying proxy…', e.message);
    return await fetchCSV(CORS_PROXY + encodeURIComponent(url));
  }
}

async function fetchProperties() {
  const grid = document.getElementById('propertiesGrid');
  const featuredGrid = document.getElementById('featuredGrid');
  const loadMsg = '<div class="property-loading"><div class="spinner"></div><p>Loading properties…</p></div>';
  if (grid) grid.innerHTML = loadMsg;
  if (featuredGrid) featuredGrid.innerHTML = loadMsg;

  try {
    const text = await loadCSV(SHEET_CSV_URL);
    const { headers, data } = parseCSV(text);
    sheetHeaders = headers;

    allProperties = data.filter(p => prop(p, 'name', 'property_name', 'title'));
    filteredProperties = [...allProperties];

    populateFilters();
    renderProperties(grid, filteredProperties);

    // Featured: rows where featured column = yes/true/1, else first FEATURED_LIMIT
    const featured = allProperties.filter(p => {
      const f = prop(p, 'featured', 'is_featured', 'feature').toLowerCase();
      return f === 'yes' || f === 'true' || f === '1';
    });
    renderFeatured(featuredGrid, featured.length ? featured.slice(0, FEATURED_LIMIT) : allProperties.slice(0, FEATURED_LIMIT));
  } catch (e) {
    const err = `<div class="property-loading"><p style="color:var(--rose)">⚠ Unable to load properties.<br><small>${e.message}</small></p></div>`;
    if (grid) grid.innerHTML = err;
    if (featuredGrid) featuredGrid.innerHTML = err;
    console.error('fetchProperties error:', e);
  }
}

// ════════════════════════════════════════════════
//  FILTERS
// ════════════════════════════════════════════════
function populateFilters() {
  const typeEl = document.getElementById('typeFilter');
  const locEl  = document.getElementById('locationFilter');
  if (!typeEl || !locEl) return;

  // Reset to first option only
  typeEl.innerHTML = '<option value="">All Types</option>';
  locEl.innerHTML  = '<option value="">All Locations</option>';

  const types = [...new Set(allProperties.map(p => prop(p,'type','property_type','listing_type')).filter(Boolean))];
  const locs  = [...new Set(allProperties.map(p => prop(p,'city','location','area','address')).filter(Boolean).map(l => l.split(',')[0].trim()))];

  types.forEach(t => { const o = document.createElement('option'); o.value = t; o.textContent = t; typeEl.appendChild(o); });
  locs.forEach(l  => { const o = document.createElement('option'); o.value = l; o.textContent = l; locEl.appendChild(o); });
}

function applyFilters() {
  const type     = document.getElementById('typeFilter')?.value || '';
  const location = document.getElementById('locationFilter')?.value || '';
  const maxPrice = document.getElementById('priceFilter')?.value || '';
  const query    = (document.getElementById('searchQuery')?.value || '').toLowerCase();

  filteredProperties = allProperties.filter(p => {
    const pType  = prop(p,'type','property_type','listing_type');
    const pLoc   = prop(p,'city','location','area','address');
    const pPrice = parseFloat(String(prop(p,'price','asking_price','amount')).replace(/[^0-9.]/g,'')) || 0;
    const pName  = prop(p,'name','property_name','title').toLowerCase();
    const pDesc  = prop(p,'description','details','notes').toLowerCase();

    if (type     && pType !== type)                return false;
    if (location && !pLoc.includes(location))     return false;
    if (maxPrice && pPrice > parseFloat(maxPrice)) return false;
    if (query    && !pName.includes(query) && !pDesc.includes(query) && !pLoc.toLowerCase().includes(query)) return false;
    return true;
  });

  renderProperties(document.getElementById('propertiesGrid'), filteredProperties);
}

// ════════════════════════════════════════════════
//  CARD BUILDER
// ════════════════════════════════════════════════
function buildCard(p, featuredBadge) {
  const name     = prop(p,'name','property_name','title') || 'Property';
  const price    = formatPrice(prop(p,'price','asking_price','amount'));
  const location = prop(p,'city','location','area','address') || 'Cebu, Philippines';
  const type     = prop(p,'type','property_type','listing_type') || 'For Sale';
  const beds     = prop(p,'bedrooms','beds','bedroom');
  const baths    = prop(p,'bathrooms','baths','bath');
  const area     = prop(p,'area','floor_area','lot_area','size');
  const desc     = prop(p,'description','details','notes');
  const mediaList = collectMedia(p);
  const firstMedia = mediaList[0];
  const fallback  = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80';

  let mediaHTML;
  if (firstMedia) {
    const url = mediaUrl(firstMedia.url);
    mediaHTML = `<img src="${url}" alt="${name}" loading="lazy" onerror="this.src='${fallback}'">`;
  } else {
    mediaHTML = `<img src="${fallback}" alt="${name}" loading="lazy">`;
  }

  const card = document.createElement('div');
  card.className = 'property-card fade-up';
  card.innerHTML = `
    <div class="property-card-media">
      ${mediaHTML}
      <div class="property-badge${featuredBadge ? ' featured' : ''}">${featuredBadge ? '⭐ Featured' : type}</div>
      <button class="property-wishlist" onclick="event.stopPropagation()" aria-label="Save">
        <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
    </div>
    <div class="property-card-body">
      <div class="property-type">${type}</div>
      <div class="property-name">${name}</div>
      <div class="property-location">
        <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ${location}
      </div>
      ${desc ? `<p class="property-desc-preview">${truncate(desc, 110)}</p>` : ''}
      <div class="property-divider"></div>
      <div class="property-features">
        ${beds  ? `<div class="property-feature"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>${beds} Beds</div>` : ''}
        ${baths ? `<div class="property-feature"><svg viewBox="0 0 24 24"><path d="M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1z"/><path d="M6 12V5a2 2 0 0 1 2-2h3v2.25"/></svg>${baths} Baths</div>` : ''}
        ${area  ? `<div class="property-feature"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>${area} sqm</div>` : ''}
      </div>
      <div class="property-footer">
        <div>
          <div class="property-price-label">Starting at</div>
          <div class="property-price">${price}</div>
        </div>
        <button class="btn btn-ghost">
          View <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    </div>`;

  card.addEventListener('click', () => openPropertyModal(p));
  return card;
}

function renderFeatured(container, properties) {
  if (!container) return;
  container.innerHTML = '';
  if (!properties.length) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px">No featured properties yet.</p>';
    return;
  }
  properties.forEach(p => container.appendChild(buildCard(p, true)));
  observeFadeUps();
}

function renderProperties(container, properties) {
  if (!container) return;
  container.innerHTML = '';
  if (!properties.length) {
    container.innerHTML = '<div class="property-loading"><p style="color:var(--muted)">No properties match your search.</p></div>';
    return;
  }
  properties.forEach(p => container.appendChild(buildCard(p, false)));
  observeFadeUps();
}

// ════════════════════════════════════════════════
//  MODAL
// ════════════════════════════════════════════════
function openPropertyModal(p) {
  const modal = document.getElementById('propertyModal');
  if (!modal) return;

  const name     = prop(p,'name','property_name','title') || 'Property';
  const price    = formatPrice(prop(p,'price','asking_price','amount'));
  const location = prop(p,'city','location','area','address') || 'Cebu, Philippines';
  const type     = prop(p,'type','property_type','listing_type') || 'For Sale';
  const beds     = prop(p,'bedrooms','beds','bedroom');
  const baths    = prop(p,'bathrooms','baths','bath');
  const area     = prop(p,'area','floor_area','lot_area','size');
  const desc     = prop(p,'description','details','notes') || 'Contact us for more details about this property.';
  const amenitiesRaw = prop(p,'amenities','features','inclusions') || '';
  const amenities = amenitiesRaw.split(/[,;|]/).map(a => a.trim()).filter(Boolean);

  // Build media lists
  const images  = collectMedia(p);
  const videos  = collectVideos(p);
  currentModalMedia = [...images.map(m => ({ ...m, kind: 'image' })), ...videos.map(v => ({ url: v, kind: 'video' }))];
  currentMediaIndex = 0;

  // Gallery HTML
  const fallback = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&q=80';
  let galleryHTML = '', dotsHTML = '';

  if (currentModalMedia.length === 0) {
    galleryHTML = `<img src="${fallback}" alt="${name}" class="active" style="display:block">`;
    dotsHTML    = `<button class="gallery-dot active"></button>`;
  } else {
    currentModalMedia.forEach((m, i) => {
      const active = i === 0 ? 'active' : '';
      const show   = i === 0 ? 'block' : 'none';
      if (m.kind === 'video' || isVideo(m.url)) {
        const src = m.url.includes('drive.google.com') ? driveVideoEmbed(m.url)
                  : (m.url.includes('youtube') || m.url.includes('youtu.be')) ? youtubeEmbed(m.url)
                  : m.url;
        if (src.includes('youtube') || src.includes('drive.google.com/file')) {
          galleryHTML += `<iframe src="${src}" class="${active}" style="display:${show};width:100%;height:100%;border:none" allowfullscreen loading="lazy"></iframe>`;
        } else {
          galleryHTML += `<video src="${src}" class="${active}" style="display:${show}" controls playsinline preload="metadata"></video>`;
        }
      } else {
        const url = driveUrl(m.url) || m.url;
        galleryHTML += `<img src="${url}" alt="${name} ${i+1}" class="${active}" style="display:${show}" onerror="this.src='${fallback}'" loading="lazy">`;
      }
      dotsHTML += `<button class="gallery-dot${active ? ' active' : ''}" onclick="goToMedia(${i})"></button>`;
    });
  }

  document.getElementById('modalGallery').innerHTML = galleryHTML + `
    <div class="modal-gallery-nav">
      <button class="gallery-btn" onclick="prevMedia()"><svg viewBox="0 0 24 24" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
      <button class="gallery-btn" onclick="nextMedia()"><svg viewBox="0 0 24 24" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
    </div>
    <div class="modal-gallery-dots">${dotsHTML}</div>`;

  // Hide nav if only 1 item
  if (currentModalMedia.length <= 1) {
    document.querySelectorAll('.modal-gallery-nav, .modal-gallery-dots').forEach(el => el.style.display = 'none');
  }

  document.getElementById('modalTitle').textContent = name;
  document.getElementById('modalType').textContent  = type;
  document.getElementById('modalLocation').innerHTML = `<svg viewBox="0 0 24 24" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${location}`;
  document.getElementById('modalPrice').textContent = price;

  // Description — preserve line breaks
  const descEl = document.getElementById('modalDesc');
  descEl.innerHTML = desc.replace(/\n/g, '<br>');

  document.getElementById('modalFeatures').innerHTML = [
    beds  ? `<div class="modal-feature"><svg viewBox="0 0 24 24" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>${beds} Bedrooms</div>` : '',
    baths ? `<div class="modal-feature"><svg viewBox="0 0 24 24" stroke-width="1.5"><path d="M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1z"/><path d="M6 12V5a2 2 0 0 1 2-2h3v2.25"/></svg>${baths} Bathrooms</div>` : '',
    area  ? `<div class="modal-feature"><svg viewBox="0 0 24 24" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>${area} sqm</div>` : '',
  ].filter(Boolean).join('');

  // Amenities
  const amenEl = document.getElementById('modalAmenities');
  if (amenities.length) {
    amenEl.style.display = '';
    document.getElementById('modalAmenitiesGrid').innerHTML = amenities.map(a => `<div class="amenity-item"><span class="amenity-dot"></span>${a}</div>`).join('');
  } else {
    amenEl.style.display = 'none';
  }

  // Dynamic extra fields (any sheet column not already shown)
  const knownKeys = new Set(['name','property_name','title','price','asking_price','amount','city','location','area','address','bedrooms','beds','bedroom','bathrooms','baths','bath','floor_area','lot_area','size','description','details','notes','amenities','features','inclusions','type','property_type','listing_type','featured','is_featured','feature','image','image_url','photo','thumbnail','video','video_url','youtube']);
  const extraEl = document.getElementById('modalExtraFields');
  if (extraEl) {
    const extras = sheetHeaders.filter(h => !knownKeys.has(h) && p[h] && !/image\d+|photo_?\d+|video\d+/.test(h));
    extraEl.innerHTML = extras.map(h => `
      <div class="modal-extra-field">
        <span class="extra-label">${h.replace(/_/g,' ')}</span>
        <span class="extra-value">${p[h]}</span>
      </div>`).join('');
    extraEl.style.display = extras.length ? '' : 'none';
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

window.openPropertyModal = openPropertyModal;

function closeModal() {
  const modal = document.getElementById('propertyModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}
window.closeModal = closeModal;

function goToMedia(index) {
  const gallery = document.getElementById('modalGallery');
  if (!gallery) return;
  const items = gallery.querySelectorAll('img, video, iframe');
  const dots  = gallery.querySelectorAll('.gallery-dot');
  items.forEach((el, i) => { el.classList.toggle('active', i === index); el.style.display = i === index ? 'block' : 'none'; });
  dots.forEach((d, i) => d.classList.toggle('active', i === index));
  currentMediaIndex = index;
}
window.goToMedia = goToMedia;
window.prevMedia = () => { if (currentModalMedia.length > 1) goToMedia((currentMediaIndex - 1 + currentModalMedia.length) % currentModalMedia.length); };
window.nextMedia = () => { if (currentModalMedia.length > 1) goToMedia((currentMediaIndex + 1) % currentModalMedia.length); };

// ════════════════════════════════════════════════
//  AGENT CAROUSEL
// ════════════════════════════════════════════════
const agents = [
  {
    name: 'Shervyn S. Bacus',
    position: 'Real Estate Agent',
    bio: 'With years of experience in the Cebu property market, Shervyn has helped hundreds of families and investors find their dream homes. Expert in residential condominiums, house & lot, and OFW transactions.',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=85',
    messenger: MESSENGER_URL,
  },
  {
    name: 'SG Prime Living Team',
    position: 'Property Specialists',
    bio: 'Our dedicated team of property specialists covers every corner of Metro Cebu. Whether you\'re buying, selling, or investing, we\'re here to guide you every step of the way.',
    photo: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&q=85',
    messenger: MESSENGER_URL,
  }
];

let agentIndex = 0;

function renderAgentCarousel() {
  const wrap = document.getElementById('agentCarousel');
  if (!wrap) return;

  wrap.innerHTML = agents.map((a, i) => `
    <div class="agent-slide${i === 0 ? ' active' : ''}" data-index="${i}">
      <div class="agent-photo-wrap">
        <img src="${a.photo}" alt="${a.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&q=85'">
      </div>
      <div class="agent-info">
        <div class="agent-name">${a.name}</div>
        <div class="agent-position">${a.position}</div>
        <p class="agent-bio">${a.bio}</p>
        <a href="${a.messenger}" target="_blank" rel="noopener" class="btn btn-rose" style="margin-top:16px">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.929 1.435 5.545 3.68 7.27V22l3.352-1.844C10.006 20.38 10.979 20.5 12 20.5c5.523 0 10-4.145 10-9.257C22 6.145 17.523 2 12 2z"/></svg>
          Message on Messenger
        </a>
      </div>
    </div>`).join('');

  // Dots
  const dotsEl = document.getElementById('agentDots');
  if (dotsEl) {
    dotsEl.innerHTML = agents.map((_, i) => `<button class="agent-dot${i===0?' active':''}" onclick="goToAgent(${i})"></button>`).join('');
  }
}

function goToAgent(idx) {
  agentIndex = idx;
  document.querySelectorAll('.agent-slide').forEach((s, i) => s.classList.toggle('active', i === idx));
  document.querySelectorAll('.agent-dot').forEach((d, i) => d.classList.toggle('active', i === idx));
}
window.goToAgent = goToAgent;
window.prevAgent = () => goToAgent((agentIndex - 1 + agents.length) % agents.length);
window.nextAgent = () => goToAgent((agentIndex + 1) % agents.length);

// ════════════════════════════════════════════════
//  AI CHAT
// ════════════════════════════════════════════════
function buildSystemPrompt() {
  const names = allProperties.map(p => prop(p,'name','property_name','title')).filter(Boolean).slice(0,15).join(', ');
  const locs  = [...new Set(allProperties.map(p => prop(p,'city','location','area','address')).filter(Boolean))].slice(0,10).join(', ');
  return `You are Maya, a friendly and knowledgeable real estate assistant for SG Prime Living, a real estate agency based in Cebu, Philippines.
You help buyers and investors find their dream home. Respond in the same language the user writes — English or Filipino/Tagalog/Bisaya.

Current listings: ${allProperties.length} properties.
Properties: ${names}.
Locations: ${locs}.

Contact: Phone 9661833385 | Email Sgprimeliving@gmail.com | Facebook: SG PRIME LIVING | Location: Cebu, Philippines.

Be warm, concise, and professional. For site viewings ask for preferred date/time and contact number. Always mention Messenger for fast responses.`;
}

function openAIChat() {
  const panel = document.getElementById('aiChatPanel');
  if (!panel) return;
  panel.classList.add('open');
  if (chatHistory.length === 0) {
    appendMsg('bot', 'Hi! I\'m Maya, your SG Prime Living assistant 🏡\n\nKumusta! Ako si Maya — nandito ako para tulungan kang mahanap ang iyong dream home.\n\nHow can I help you today?');
  }
  document.getElementById('aiInput')?.focus();
}
window.openAIChat = openAIChat;

async function sendAIMessage(msg) {
  const messagesEl = document.getElementById('aiMessages');
  if (!messagesEl || !msg.trim()) return;
  chatHistory.push({ role: 'user', content: msg });
  appendMsg('user', msg);
  const typing = appendTyping();

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: buildSystemPrompt(),
        messages: chatHistory,
      }),
    });
    const data = await res.json();
    const reply = data.content?.[0]?.text || 'Sorry, I could not get a response right now.';
    chatHistory.push({ role: 'assistant', content: reply });
    typing.remove();
    appendMsg('bot', reply);
  } catch {
    typing.remove();
    appendMsg('bot', 'Hindi ko ma-access ang server. / Cannot reach server right now. Please try again.');
  }
}

function appendMsg(role, text) {
  const el = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  div.innerHTML = `<div class="ai-msg-bubble">${text.replace(/\n/g,'<br>')}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}

function appendTyping() {
  const el = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = 'ai-msg bot';
  div.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  return div;
}

function initAIChat() {
  const fab     = document.getElementById('fabAI');
  const panel   = document.getElementById('aiChatPanel');
  const closeBtn = document.getElementById('aiClose');
  const input   = document.getElementById('aiInput');
  const sendBtn = document.getElementById('aiSend');

  fab?.addEventListener('click', openAIChat);
  closeBtn?.addEventListener('click', () => panel?.classList.remove('open'));

  function send() {
    const val = input?.value.trim();
    if (!val) return;
    input.value = '';
    sendAIMessage(val);
  }
  sendBtn?.addEventListener('click', send);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  document.querySelectorAll('.ai-quick-btn').forEach(btn => btn.addEventListener('click', () => {
    openAIChat();
    sendAIMessage(btn.dataset.msg || btn.textContent);
  }));
}

// ════════════════════════════════════════════════
//  FAQ
// ════════════════════════════════════════════════
function initFAQ() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item   = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => {
        i.classList.remove('open');
        i.querySelector('.faq-answer').style.maxHeight = '0';
      });
      if (!isOpen) {
        item.classList.add('open');
        const ans = item.querySelector('.faq-answer');
        ans.style.maxHeight = ans.scrollHeight + 'px';
      }
    });
  });
}

// ════════════════════════════════════════════════
//  NAVBAR
// ════════════════════════════════════════════════
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => navbar?.classList.toggle('scrolled', window.scrollY > 60), { passive: true });

  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  hamburger?.addEventListener('click', () => {
    mobileMenu?.classList.toggle('open');
    hamburger.classList.toggle('open');
  });
  mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    hamburger?.classList.remove('open');
  }));
}

// ════════════════════════════════════════════════
//  ANIMATIONS
// ════════════════════════════════════════════════
function observeFadeUps() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-up:not(.visible)').forEach(el => obs.observe(el));
}

// ════════════════════════════════════════════════
//  CONTACT FORM
// ════════════════════════════════════════════════
function initContactForm() {
  const form    = document.getElementById('contactForm');
  const success = document.getElementById('formSuccess');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.textContent = 'Sending…';
    btn.disabled = true;
    await new Promise(r => setTimeout(r, 1000));
    form.style.display = 'none';
    if (success) success.style.display = 'block';
  });
}

// ════════════════════════════════════════════════
//  SMOOTH SCROLL (same-page anchors only)
// ════════════════════════════════════════════════
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });
}

// ════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initFAQ();
  initContactForm();
  initAIChat();
  initSmoothScroll();
  observeFadeUps();
  renderAgentCarousel();
  fetchProperties();

  ['typeFilter','locationFilter','priceFilter'].forEach(id =>
    document.getElementById(id)?.addEventListener('change', applyFilters));
  document.getElementById('searchQuery')?.addEventListener('input', applyFilters);
  document.getElementById('searchBtn')?.addEventListener('click', applyFilters);

  document.getElementById('propertyModal')?.addEventListener('click', e => {
    if (e.target.id === 'propertyModal') closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // "Inquire" nav button → open AI chat
  document.getElementById('navInquireBtn')?.addEventListener('click', e => {
    e.preventDefault();
    openAIChat();
  });
});
