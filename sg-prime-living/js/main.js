/* ===== SG PRIME LIVING — MAIN JS ===== */

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTZ8KY6CePMOc3xOuj9UYlkmVCckiQkv9gB4EmlQXS0BteEN4LNEeVtUyBHC47ctJCJTxhS-repQvhS/pub?output=csv';
// CORS proxy fallback — used automatically when direct fetch is blocked (e.g. on Vercel/GitHub Pages)
const CORS_PROXY = 'https://corsproxy.io/?url=';

// ─── STATE ────────────────────────────────────────────────
let allProperties = [];
let filteredProperties = [];
let currentModalMedia = [];
let currentMediaIndex = 0;

// ─── HELPERS ─────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim().toLowerCase().replace(/\s+/g,'_'));
  return lines.slice(1).map(line => {
    const vals = [];
    let cur = '', inQuotes = false;
    for (let c of line) {
      if (c === '"') { inQuotes = !inQuotes; }
      else if (c === ',' && !inQuotes) { vals.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = (vals[i] || '').replace(/^"|"$/g,'').trim());
    return obj;
  });
}

function formatPrice(raw) {
  if (!raw) return 'Contact for Price';
  const num = parseFloat(raw.replace(/[^0-9.]/g,''));
  if (isNaN(num)) return raw;
  if (num >= 1_000_000) return '₱' + (num/1_000_000).toFixed(1).replace(/\.0$/,'') + 'M';
  if (num >= 1_000) return '₱' + (num/1_000).toFixed(0) + 'K';
  return '₱' + num.toLocaleString();
}

function mediaUrl(url) {
  if (!url) return '';
  // Google Drive direct link conversion
  const driveMatch = url.match(/[-\w]{25,}/);
  if (url.includes('drive.google.com') && driveMatch) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[0]}`;
  }
  return url;
}

function isVideo(url) {
  return url && /\.(mp4|webm|ogg|mov)/i.test(url) || (url || '').includes('youtube') || (url || '').includes('youtu.be');
}

function youtubeEmbed(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}?autoplay=0&rel=0` : url;
}

function prop(p, ...keys) {
  for (const k of keys) if (p[k]) return p[k];
  return '';
}

// ─── FETCH PROPERTIES ────────────────────────────────────
async function fetchCSV(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  // Sanity check: valid CSV starts with a letter/quote, not an HTML tag
  if (text.trimStart().startsWith('<')) throw new Error('Got HTML instead of CSV — likely CORS block');
  return text;
}

async function fetchProperties() {
  const grid = document.getElementById('propertiesGrid');
  const featuredGrid = document.getElementById('featuredGrid');
  if (grid) grid.innerHTML = '<div class="property-loading"><div class="spinner"></div><p>Loading properties…</p></div>';
  if (featuredGrid) featuredGrid.innerHTML = '<div class="property-loading"><div class="spinner"></div><p>Loading featured properties…</p></div>';

  let text = null;

  // Try direct fetch first (works on localhost), then fall back to CORS proxy (needed on Vercel/GitHub Pages)
  try {
    text = await fetchCSV(SHEET_CSV_URL);
  } catch (directErr) {
    console.warn('Direct fetch failed, trying CORS proxy…', directErr.message);
    try {
      text = await fetchCSV(CORS_PROXY + encodeURIComponent(SHEET_CSV_URL));
    } catch (proxyErr) {
      const errMsg = `<div class="property-loading"><p style="color:var(--rose)">⚠ Unable to load properties.<br><small>Make sure your Google Sheet is published as CSV (File → Share → Publish to web).</small></p></div>`;
      if (grid) grid.innerHTML = errMsg;
      if (featuredGrid) featuredGrid.innerHTML = errMsg;
      console.error('Both direct and proxy fetch failed:', proxyErr);
      return;
    }
  }

  try {
    allProperties = parseCSV(text).filter(p => prop(p,'name','property_name','title'));
    filteredProperties = [...allProperties];
    populateFilters();
    renderProperties(grid, filteredProperties);
    renderFeatured(featuredGrid, allProperties.slice(0,3));
  } catch(parseErr) {
    console.error('CSV parse error:', parseErr);
  }
}

function populateFilters() {
  const typeFilter = document.getElementById('typeFilter');
  const locationFilter = document.getElementById('locationFilter');
  if (!typeFilter || !locationFilter) return;

  const types = [...new Set(allProperties.map(p => prop(p,'type','property_type','listing_type')).filter(Boolean))];
  const locs = [...new Set(allProperties.map(p => prop(p,'city','location','area','address')).filter(Boolean).map(l => l.split(',')[0].trim()))];

  types.forEach(t => {
    const o = document.createElement('option'); o.value = t; o.textContent = t;
    typeFilter.appendChild(o);
  });
  locs.forEach(l => {
    const o = document.createElement('option'); o.value = l; o.textContent = l;
    locationFilter.appendChild(o);
  });
}

function renderFeatured(container, properties) {
  if (!container) return;
  if (!properties.length) { container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:40px">No properties found.</p>'; return; }
  container.innerHTML = '';
  properties.forEach((p, i) => container.appendChild(buildCard(p, true)));
}

function renderProperties(container, properties) {
  if (!container) return;
  if (!properties.length) { container.innerHTML = '<div class="property-loading"><p style="color:var(--muted)">No properties match your search.</p></div>'; return; }
  container.innerHTML = '';
  properties.forEach(p => container.appendChild(buildCard(p, false)));
  observeFadeUps();
}

function buildCard(p, featured) {
  const name = prop(p,'name','property_name','title') || 'Property';
  const price = formatPrice(prop(p,'price','asking_price','amount'));
  const location = prop(p,'city','location','area','address') || 'Cebu, Philippines';
  const type = prop(p,'type','property_type','listing_type') || 'For Sale';
  const beds = prop(p,'bedrooms','beds','bedroom');
  const baths = prop(p,'bathrooms','baths','bath');
  const area = prop(p,'area','floor_area','lot_area','size');
  const imgRaw = prop(p,'image','image_url','photo','thumbnail','images');
  const img = mediaUrl(imgRaw) || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80';
  const videoRaw = prop(p,'video','video_url','youtube');

  const card = document.createElement('div');
  card.className = 'property-card fade-up';
  card.innerHTML = `
    <div class="property-card-media">
      ${videoRaw && isVideo(videoRaw)
        ? `<video src="${mediaUrl(videoRaw)}" muted loop playsinline poster="${img}" onmouseenter="this.play()" onmouseleave="this.pause()"></video>`
        : `<img src="${img}" alt="${name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80'">`
      }
      <div class="property-badge${featured ? ' featured' : ''}">${featured ? '⭐ Featured' : type}</div>
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
      <div class="property-divider"></div>
      <div class="property-features">
        ${beds ? `<div class="property-feature"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>${beds} Beds</div>` : ''}
        ${baths ? `<div class="property-feature"><svg viewBox="0 0 24 24"><path d="M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1z"/><path d="M6 12V5a2 2 0 0 1 2-2h3v2.25"/></svg>${baths} Baths</div>` : ''}
        ${area ? `<div class="property-feature"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>${area} sqm</div>` : ''}
      </div>
      <div class="property-footer">
        <div>
          <div class="property-price-label">Starting at</div>
          <div class="property-price">${price}</div>
        </div>
        <button class="btn btn-ghost" onclick="openPropertyModal(allProperties.indexOf(window._lastRendered?.find(x=>x===this)||${JSON.stringify(p).replace(/"/g,'&quot;')}))">
          View <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>
    </div>`;
  card.addEventListener('click', () => openPropertyModal(p));
  return card;
}

// ─── MODAL ────────────────────────────────────────────────
function openPropertyModal(p) {
  const modal = document.getElementById('propertyModal');
  if (!modal) return;

  const name = prop(p,'name','property_name','title') || 'Property';
  const price = formatPrice(prop(p,'price','asking_price','amount'));
  const location = prop(p,'city','location','area','address') || 'Cebu, Philippines';
  const type = prop(p,'type','property_type','listing_type') || 'For Sale';
  const beds = prop(p,'bedrooms','beds','bedroom');
  const baths = prop(p,'bathrooms','baths','bath');
  const area = prop(p,'area','floor_area','lot_area','size');
  const desc = prop(p,'description','details','notes') || 'Contact us for more details about this property.';
  const amenitiesRaw = prop(p,'amenities','features','inclusions') || '';
  const amenities = amenitiesRaw.split(/[,;|]/).map(a=>a.trim()).filter(Boolean);

  // Gather all media
  const mediaKeys = ['image','image_url','photo','thumbnail','images','image2','image3','image4','video','video_url','youtube'];
  currentModalMedia = [];
  mediaKeys.forEach(k => { if (p[k]) currentModalMedia.push(p[k]); });
  if (!currentModalMedia.length) currentModalMedia.push('https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&q=80');
  currentMediaIndex = 0;

  // Build gallery HTML
  let galleryHTML = '';
  let dotsHTML = '';
  currentModalMedia.forEach((m, i) => {
    const url = mediaUrl(m);
    if (isVideo(m)) {
      const src = m.includes('youtube') ? youtubeEmbed(m) : url;
      galleryHTML += `<iframe class="${i===0?'active':''}" src="${src}" frameborder="0" allowfullscreen style="width:100%;height:100%;display:${i===0?'block':'none'};border:none"></iframe>`;
    } else {
      galleryHTML += `<img src="${url}" alt="${name} ${i+1}" class="${i===0?'active':''}" onerror="this.src='https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=900&q=80'">`;
    }
    dotsHTML += `<button class="gallery-dot${i===0?' active':''}" onclick="goToMedia(${i})" aria-label="Image ${i+1}"></button>`;
  });

  document.getElementById('modalGallery').innerHTML = galleryHTML + `
    <div class="modal-gallery-nav">
      <button class="gallery-btn" onclick="prevMedia()"><svg viewBox="0 0 24 24" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
      <button class="gallery-btn" onclick="nextMedia()"><svg viewBox="0 0 24 24" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
    </div>
    <div class="modal-gallery-dots">${dotsHTML}</div>`;

  document.getElementById('modalTitle').textContent = name;
  document.getElementById('modalType').textContent = type;
  document.getElementById('modalLocation').innerHTML = `<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${location}`;
  document.getElementById('modalPrice').textContent = price;
  document.getElementById('modalDesc').textContent = desc;
  document.getElementById('modalFeatures').innerHTML = [
    beds ? `<div class="modal-feature"><svg viewBox="0 0 24 24" stroke-width="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>${beds} Bedrooms</div>` : '',
    baths ? `<div class="modal-feature"><svg viewBox="0 0 24 24" stroke-width="1.5"><path d="M4 12h16a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3a1 1 0 0 1 1-1z"/><path d="M6 12V5a2 2 0 0 1 2-2h3v2.25"/></svg>${baths} Bathrooms</div>` : '',
    area ? `<div class="modal-feature"><svg viewBox="0 0 24 24" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>${area} sqm</div>` : '',
  ].filter(Boolean).join('');

  if (amenities.length) {
    document.getElementById('modalAmenities').style.display = '';
    document.getElementById('modalAmenitiesGrid').innerHTML = amenities.map(a => `<div class="amenity-item"><span class="amenity-dot"></span>${a}</div>`).join('');
  } else {
    document.getElementById('modalAmenities').style.display = 'none';
  }

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('propertyModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
}

window.openPropertyModal = openPropertyModal;
window.closeModal = closeModal;

function goToMedia(index) {
  const gallery = document.getElementById('modalGallery');
  if (!gallery) return;
  const items = gallery.querySelectorAll('img, video, iframe');
  const dots = gallery.querySelectorAll('.gallery-dot');
  items.forEach((el,i) => { el.className = i===index?'active':''; el.style.display = i===index?'block':'none'; });
  dots.forEach((d,i) => d.classList.toggle('active', i===index));
  currentMediaIndex = index;
}
window.goToMedia = goToMedia;
window.prevMedia = () => goToMedia((currentMediaIndex - 1 + currentModalMedia.length) % currentModalMedia.length);
window.nextMedia = () => goToMedia((currentMediaIndex + 1) % currentModalMedia.length);

// ─── SEARCH / FILTER ──────────────────────────────────────
function applyFilters() {
  const type = document.getElementById('typeFilter')?.value || '';
  const location = document.getElementById('locationFilter')?.value || '';
  const maxPrice = document.getElementById('priceFilter')?.value || '';
  const query = document.getElementById('searchQuery')?.value.toLowerCase() || '';

  filteredProperties = allProperties.filter(p => {
    const pType = prop(p,'type','property_type','listing_type');
    const pLoc = prop(p,'city','location','area','address');
    const pPrice = parseFloat(prop(p,'price','asking_price','amount').replace(/[^0-9.]/g,'')) || 0;
    const pName = prop(p,'name','property_name','title').toLowerCase();
    const pDesc = prop(p,'description','details','notes').toLowerCase();

    if (type && pType !== type) return false;
    if (location && !pLoc.includes(location)) return false;
    if (maxPrice && pPrice > parseFloat(maxPrice)) return false;
    if (query && !pName.includes(query) && !pDesc.includes(query) && !pLoc.toLowerCase().includes(query)) return false;
    return true;
  });

  renderProperties(document.getElementById('propertiesGrid'), filteredProperties);
}

// ─── FAQ ──────────────────────────────────────────────────
function initFAQ() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => { i.classList.remove('open'); i.querySelector('.faq-answer').style.maxHeight = '0'; });
      if (!isOpen) {
        item.classList.add('open');
        const answer = item.querySelector('.faq-answer');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });
}

// ─── NAVBAR ───────────────────────────────────────────────
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => navbar?.classList.toggle('scrolled', window.scrollY > 60), { passive: true });

  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  hamburger?.addEventListener('click', () => mobileMenu?.classList.toggle('open'));
  mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileMenu.classList.remove('open')));
}

// ─── FADE UP OBSERVER ────────────────────────────────────
function observeFadeUps() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.fade-up:not(.visible)').forEach(el => observer.observe(el));
}

// ─── CONTACT FORM ────────────────────────────────────────
function initContactForm() {
  const form = document.getElementById('contactForm');
  const success = document.getElementById('formSuccess');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.textContent = 'Sending…';
    btn.disabled = true;
    await new Promise(r => setTimeout(r, 1200));
    form.style.display = 'none';
    if (success) success.style.display = 'block';
  });
}

// ─── AI CHAT ─────────────────────────────────────────────
const systemPrompt = () => `You are Maya, a friendly and knowledgeable real estate assistant for SG Prime Living, a real estate agency based in Cebu, Philippines. 
You help buyers and investors find their dream home. You can respond in both English and Filipino/Tagalog — match the language the user uses.

Current property listings loaded: ${allProperties.length} properties.
Property names: ${allProperties.map(p => prop(p,'name','property_name','title')).filter(Boolean).slice(0,10).join(', ')}.
Locations: ${[...new Set(allProperties.map(p => prop(p,'city','location','area','address')).filter(Boolean))].slice(0,8).join(', ')}.

Contact details:
- Phone: 9661833385
- Email: Sgprimeliving@gmail.com
- Facebook: SG PRIME LIVING
- Location: Cebu, Philippines

Help users with: property inquiries, pricing questions, site viewing schedules, mortgage questions, and neighborhood information. 
Be warm, professional, and concise. For site viewing, ask for their preferred date/time and phone number.`;

let chatHistory = [];

async function sendAIMessage(msg) {
  const messages = document.getElementById('aiMessages');
  if (!messages) return;
  chatHistory.push({ role: 'user', content: msg });
  appendMsg('user', msg);
  const typing = appendTyping();

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        system: systemPrompt(),
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
    appendMsg('bot', 'Hindi ko ma-access ang server ngayon. / I cannot reach the server right now. Please try again.');
  }
}

function appendMsg(role, text) {
  const messages = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = `ai-msg ${role}`;
  div.innerHTML = `<div class="ai-msg-bubble">${text.replace(/\n/g,'<br>')}</div>`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function appendTyping() {
  const messages = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = 'ai-msg bot';
  div.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function initAIChat() {
  const fab = document.getElementById('fabAI');
  const panel = document.getElementById('aiChatPanel');
  const closeBtn = document.getElementById('aiClose');
  const input = document.getElementById('aiInput');
  const sendBtn = document.getElementById('aiSend');

  fab?.addEventListener('click', () => {
    panel?.classList.toggle('open');
    if (panel?.classList.contains('open') && chatHistory.length === 0) {
      appendMsg('bot', 'Hi! I\'m Maya, your SG Prime Living assistant 🏡\n\nKumusta! Ako si Maya, para tulungan ka mahanap ang iyong dream home.\n\nHow can I help you today?');
    }
    input?.focus();
  });

  closeBtn?.addEventListener('click', () => panel?.classList.remove('open'));

  function send() {
    const val = input?.value.trim();
    if (!val) return;
    input.value = '';
    sendAIMessage(val);
  }

  sendBtn?.addEventListener('click', send);
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

  document.querySelectorAll('.ai-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => sendAIMessage(btn.textContent));
  });
}

// ─── SMOOTH SCROLL ────────────────────────────────────────
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });
}

// ─── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initFAQ();
  initContactForm();
  initAIChat();
  initSmoothScroll();
  observeFadeUps();
  fetchProperties();

  // Filter event listeners
  ['typeFilter','locationFilter','priceFilter'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', applyFilters);
  });
  document.getElementById('searchQuery')?.addEventListener('input', applyFilters);
  document.getElementById('searchBtn')?.addEventListener('click', applyFilters);

  // Modal close on backdrop
  document.getElementById('propertyModal')?.addEventListener('click', e => {
    if (e.target.id === 'propertyModal') closeModal();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
});
