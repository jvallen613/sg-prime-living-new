# SG Prime Living — Real Estate Website v3

A modern, professional real estate website for **SG Prime Living** (Cebu, Philippines).  
Properties load automatically from Google Sheets — no coding required to update listings.

---

## 📁 Project Structure

```
sg-prime-living/
├── index.html              ← Homepage
├── css/
│   └── styles.css          ← All styles (single clean file)
├── js/
│   ├── main.js             ← Core: sheets, modal, AI chat, carousel
│   └── blog.js             ← Blog & Vlog page loader
├── pages/
│   ├── properties.html     ← All listings page
│   ├── about.html          ← About / agents page
│   ├── blog.html           ← Blog posts page
│   ├── vlogs.html          ← Video tours page
│   └── contact.html        ← Contact / inquiry form
├── vercel.json             ← Vercel deployment config
└── README.md
```

---

## ✅ Features

| Feature | Details |
|---|---|
| **Google Sheets sync** | Auto-loads from published CSV. CORS-proxy fallback for Vercel. |
| **Dynamic columns** | New sheet columns appear automatically — no code edits needed |
| **Long description fix** | Robust CSV parser handles multiline quoted fields. Cards show truncated preview; modal shows full text with line breaks |
| **Google Drive media** | Share links auto-converted to direct display/embed URLs |
| **Image carousel** | Multiple images cycle in the property modal with dots & arrows |
| **Video support** | YouTube embeds + Google Drive video previews |
| **Featured flag** | Add `featured = YES` column to highlight properties on homepage |
| **AI Chat (Maya)** | Claude-powered assistant, responds in English & Filipino/Bisaya |
| **Messenger FABs** | Floating buttons for Messenger + AI chat on every page |
| **Agent carousel** | 2-agent slider with arrows and dot navigation |
| **Blog page** | Dynamic cards from Google Sheet tab (gid=1) or fallback posts |
| **Vlogs page** | YouTube + Drive video grid from sheet tab (gid=2) |
| **6 pages** | Home, Properties, About, Blog, Vlogs, Contact |
| **Mobile responsive** | Works on all screen sizes |

---

## 📊 Google Sheet Setup

### Main Properties Sheet (Tab 1 — default)

Publish: **File → Share → Publish to web → CSV**

Supported column names (all optional except `name`):

| Column | Example |
|---|---|
| `name` | Casa Verde Residences |
| `type` | For Sale / Condo / House & Lot |
| `price` | 3500000 |
| `location` | Talisay City, Cebu |
| `city` | Talisay |
| `bedrooms` | 3 |
| `bathrooms` | 2 |
| `area` | 65 |
| `description` | Multi-line OK — parser handles it |
| `amenities` | Pool, Gym, Parking, Security |
| `image` | Google Drive share link or direct URL |
| `image2`, `image3` … | Additional images |
| `video` | YouTube URL or Google Drive video link |
| `featured` | YES (shows on homepage featured section) |

> **Any new column you add appears automatically** in the property detail modal as an extra field — no code changes needed.

### Blog Sheet (Tab 2 — gid=1)

Columns: `title`, `summary`, `image`, `date`, `category`, `link`

### Vlog Sheet (Tab 3 — gid=2)

Columns: `title`, `video` (YouTube URL or Drive link), `summary`, `date`

### Google Drive Images

1. Upload image → right-click → **Share → Anyone with link → Viewer**
2. Copy link: `https://drive.google.com/file/d/FILE_ID/view`
3. Paste directly in the sheet — the site converts it automatically

---

## 🚀 Deploy to GitHub + Vercel

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "SG Prime Living v3"
git remote add origin https://github.com/jvallen613/sg-pime-living.git
git push -u origin main --force
```

### Step 2 — Vercel Auto-Deploy

- Vercel watches your GitHub repo
- Every `git push` triggers a redeploy automatically
- No build settings needed — it's a static site

### Step 3 — Updating Properties

Just edit your Google Sheet. Changes appear on the live site on the next page load — **no git push needed**.

---

## 🎨 Customization

### Change Brand Colors

Edit `:root` in `css/styles.css`:
```css
--rose:      #C9735A;   /* Main accent — change this */
--charcoal:  #1C1C1E;   /* Dark text / buttons */
--cream:     #FAF8F5;   /* Page background */
```

### Update Agent Info

In `js/main.js`, find the `agents` array (line ~494):
```js
const agents = [
  { name: 'Shervyn S. Bacus', position: '...', bio: '...', photo: 'URL', messenger: '...' },
  { name: 'Second Agent',     position: '...', bio: '...', photo: 'URL', messenger: '...' },
];
```

### Update Contact Details

Search and replace in all HTML files:
- `SGPrimeLiving` → your Messenger page username
- `Sgprimeliving@gmail.com` → your email
- `9661833385` → your phone

### Change Google Sheet URL

In `js/main.js` line 3:
```js
const SHEET_CSV_URL = 'YOUR_PUBLISHED_CSV_URL_HERE';
```

---

## 🤖 AI Chat (Maya)

The AI assistant uses the Anthropic Claude API. It:
- Knows your current property listings
- Responds in English, Filipino, Tagalog, or Bisaya
- Helps with property inquiries, viewings, and financing questions
- References Messenger for follow-up

The API key is handled automatically in the claude.ai environment. For standalone deployment, add a serverless proxy (see `api/chat.js` example below).

### Secure API Key (Optional — for standalone deployment)

Create `api/chat.js` in your project root:
```js
export const config = { runtime: 'edge' };
export default async function handler(req) {
  const body = await req.json();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });
  return new Response(await res.text(), { headers: { 'Content-Type': 'application/json' } });
}
```

Then in Vercel dashboard → Settings → Environment Variables:
```
ANTHROPIC_API_KEY = sk-ant-...
```

And update `js/main.js` to call `/api/chat` instead of the Anthropic API directly.

---

## 🧩 Adding More Blog/Vlog Posts

Option A — Google Sheet tabs (recommended):
1. Create a new tab named "Blog" in your sheet
2. Publish it: File → Publish → select "Blog" tab → CSV
3. Update `BLOG_URL` in `js/blog.js` with the new URL (change `gid=1` to the correct tab ID)

Option B — Fallback content in `js/blog.js`:
Edit the `FALLBACK_BLOGS` / `FALLBACK_VLOGS` arrays directly.

---

## 📱 Browser Support

Chrome, Edge, Firefox, Safari 14+, iOS Safari 14+, Android Chrome
