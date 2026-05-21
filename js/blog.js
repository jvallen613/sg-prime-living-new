/* ===== BLOG & VLOG LOADER ===== */

// These should be separate sheets/tabs published as CSV
// Add gid= for each tab in Google Sheets: File → Publish → select sheet tab
const BLOG_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTZ8KY6CePMOc3xOuj9UYlkmVCckiQkv9gB4EmlQXS0BteEN4LNEeVtUyBHC47ctJCJTxhS-repQvhS/pub?gid=1&output=csv';
const VLOG_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTZ8KY6CePMOc3xOuj9UYlkmVCckiQkv9gB4EmlQXS0BteEN4LNEeVtUyBHC47ctJCJTxhS-repQvhS/pub?gid=2&output=csv';
const CORS_PROXY_B = 'https://corsproxy.io/?url=';

const FALLBACK_BLOGS = [
  { title: '5 Tips for First-Time Homebuyers in Cebu', summary: 'Buying your first home can be overwhelming. Here are five practical tips to help you navigate the process with confidence.', image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80', date: 'May 2025', category: 'Buying Tips' },
  { title: 'Why Talisay City is the Next Cebu Hotspot', summary: 'With new developments and improving infrastructure, Talisay City is rapidly becoming one of the most sought-after addresses near Cebu City.', image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&q=80', date: 'April 2025', category: 'Market Insights' },
  { title: 'Pag-IBIG vs. Bank Financing: Which is Better?', summary: 'We break down the key differences between Pag-IBIG fund loans and commercial bank financing to help you choose the right option.', image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&q=80', date: 'March 2025', category: 'Financing' },
  { title: 'OFW Property Investment Guide 2025', summary: 'Investing in Philippine real estate from abroad? This guide covers everything OFWs need to know about buying property remotely in Cebu.', image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=80', date: 'February 2025', category: 'Investment' },
  { title: 'Understanding Transfer of Title in the Philippines', summary: 'The transfer of title is one of the most important steps in property purchase. Learn what documents you need and how long it takes.', image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&q=80', date: 'January 2025', category: 'Legal Guide' },
  { title: 'Pre-Selling vs. Ready for Occupancy Properties', summary: 'Should you buy pre-selling or RFO? Each has its own advantages and risks. We help you decide what\'s right for your timeline and budget.', image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&q=80', date: 'December 2024', category: 'Buying Tips' },
];

const FALLBACK_VLOGS = [
  { title: 'Condo Tour: Studio Unit in Cebu City', video: 'https://www.youtube.com/embed/dQw4w9WgXcQ', summary: 'Full walkthrough of a studio condominium unit in the heart of Cebu City.', date: 'May 2025' },
  { title: 'House & Lot Tour in Talisay City', video: 'https://www.youtube.com/embed/dQw4w9WgXcQ', summary: 'Beautiful 3-bedroom house and lot with mountain view in Talisay.', date: 'April 2025' },
  { title: 'Why I Chose SG Prime Living — Client Story', video: 'https://www.youtube.com/embed/dQw4w9WgXcQ', summary: 'OFW client shares their experience buying a home remotely through SG Prime Living.', date: 'March 2025' },
];

async function tryFetch(url) {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const t = await r.text();
    if (t.trimStart().startsWith('<')) throw new Error('HTML response');
    return t;
  } catch (e) {
    return await fetch(CORS_PROXY_B + encodeURIComponent(url)).then(r => r.text());
  }
}

function parseSimpleCSV(text) {
  if (!text) return [];
  const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim().toLowerCase().replace(/\s+/g,'_'));
  return lines.slice(1).map(line => {
    const vals = []; let cur = '', inQ = false;
    for (let c of line) {
      if (inQ) { if (c === '"') inQ = false; else cur += c; }
      else if (c === '"') inQ = true;
      else if (c === ',') { vals.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = (vals[i]||'').replace(/^"|"$/g,'').trim());
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}

function driveThumb(url) {
  if (!url) return '';
  if (url.includes('drive.google.com')) {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
    if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  }
  return url;
}

function toEmbed(url) {
  if (!url) return '';
  const yt = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
  const drive = url.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  return url;
}

// ─── BLOG ─────────────────────────────────────────────────
async function loadBlog() {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;

  let posts = FALLBACK_BLOGS;
  try {
    const text = await tryFetch(BLOG_URL);
    const rows = parseSimpleCSV(text);
    if (rows.length) posts = rows;
  } catch(e) { /* use fallback */ }

  grid.innerHTML = '';
  grid.className = 'blog-grid';

  posts.forEach(p => {
    const title    = p.title || 'Blog Post';
    const summary  = p.summary || p.description || p.content || '';
    const image    = driveThumb(p.image || p.image_url || p.photo || '');
    const date     = p.date || p.published_date || '';
    const category = p.category || p.tag || '';
    const link     = p.link || p.url || '#';
    const fallback = 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&q=80';

    const card = document.createElement('div');
    card.className = 'blog-card fade-up';
    card.innerHTML = `
      <div class="blog-card-img">
        <img src="${image || fallback}" alt="${title}" loading="lazy" onerror="this.src='${fallback}'">
        ${category ? `<span class="blog-category">${category}</span>` : ''}
      </div>
      <div class="blog-card-body">
        ${date ? `<div class="blog-date">${date}</div>` : ''}
        <h3 class="blog-title">${title}</h3>
        <p class="blog-summary">${summary.slice(0,160).trimEnd()}${summary.length>160?'…':''}</p>
        <a href="${link}" class="btn btn-ghost" style="margin-top:12px" ${link!=='#'?'target="_blank" rel="noopener"':''}>
          Read More <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>
      </div>`;
    grid.appendChild(card);
  });

  if (typeof observeFadeUps === 'function') observeFadeUps();
}

// ─── VLOG ─────────────────────────────────────────────────
async function loadVlogs() {
  const grid = document.getElementById('vlogGrid');
  if (!grid) return;

  let vlogs = FALLBACK_VLOGS;
  try {
    const text = await tryFetch(VLOG_URL);
    const rows = parseSimpleCSV(text);
    if (rows.length) vlogs = rows;
  } catch(e) { /* use fallback */ }

  grid.innerHTML = '';
  grid.className = 'vlog-grid';

  vlogs.forEach(v => {
    const title   = v.title || 'Property Video';
    const videoRaw = v.video || v.video_url || v.youtube || v.url || '';
    const summary  = v.summary || v.description || '';
    const date     = v.date || '';
    const embed    = toEmbed(videoRaw);

    const card = document.createElement('div');
    card.className = 'vlog-card fade-up';
    card.innerHTML = `
      <div class="vlog-video-wrap">
        ${embed
          ? `<iframe src="${embed}" allowfullscreen loading="lazy" title="${title}"></iframe>`
          : `<div class="vlog-no-video"><svg viewBox="0 0 24 24" width="40" height="40" stroke="var(--muted)" fill="none" stroke-width="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg><p>Video coming soon</p></div>`
        }
      </div>
      <div class="vlog-card-body">
        ${date ? `<div class="blog-date">${date}</div>` : ''}
        <h3 class="blog-title">${title}</h3>
        ${summary ? `<p class="blog-summary">${summary.slice(0,140)}${summary.length>140?'…':''}</p>` : ''}
        <a href="https://m.me/SGPrimeLiving" target="_blank" rel="noopener" class="btn btn-ghost" style="margin-top:12px">
          Inquire About This Property <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" fill="none" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>
      </div>`;
    grid.appendChild(card);
  });

  if (typeof observeFadeUps === 'function') observeFadeUps();
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('blogGrid'))  loadBlog();
  if (document.getElementById('vlogGrid'))  loadVlogs();
});
