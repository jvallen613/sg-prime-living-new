# SG Prime Living — Real Estate Website

A modern, professional real estate website for **SG Prime Living** built with pure HTML, CSS, and JavaScript. Properties load automatically from Google Sheets — no coding required to update listings.

---

## 🗂 Project Structure

```
sg-prime-living/
├── index.html          # Main website (single page)
├── css/
│   └── styles.css      # All styles
├── js/
│   └── main.js         # Google Sheets integration + all features
├── vercel.json         # Vercel deployment config
└── README.md           # This file
```

---

## ✅ Features

- **Auto-updating listings** from Google Sheets CSV
- **AI Chat Assistant** (Maya) — powered by Claude, responds in English & Filipino
- **Property detail modal** with image gallery, videos, amenities
- **Search & filter** by type, location, price
- **Messenger floating button** for instant inquiries
- **Contact form** with success state
- **FAQ accordion**
- **Testimonials section**
- **Mobile-responsive** design
- **Smooth animations** and scroll effects

---

## 📊 Google Sheets Setup

### Step 1 — Prepare your Sheet

Create columns with these **exact header names** (column order doesn't matter):

| Column | Description | Example |
|--------|-------------|---------|
| `name` | Property name | Casa Verde Residences |
| `type` | Listing type | For Sale / For Rent / Condo / House & Lot |
| `price` | Price in PHP | 3500000 |
| `location` | Full address | Talisay City, Cebu |
| `city` | City only | Talisay |
| `bedrooms` | Number of bedrooms | 3 |
| `bathrooms` | Number of bathrooms | 2 |
| `area` | Floor area in sqm | 65 |
| `description` | Property description | Spacious 3BR unit with mountain view... |
| `amenities` | Comma-separated list | Pool, Gym, Parking, 24/7 Security |
| `image` | Image URL | https://drive.google.com/file/d/XXXX/view |
| `image2` | Additional image | https://... |
| `image3` | Additional image | https://... |
| `video` | Video or YouTube URL | https://youtu.be/XXXX |

### Step 2 — Publish your Sheet as CSV

1. Open your Google Sheet
2. Click **File → Share → Publish to web**
3. Under "Link", choose:
   - Sheet: your data sheet
   - Format: **Comma-separated values (.csv)**
4. Click **Publish** → confirm
5. Copy the URL — it looks like:
   ```
   https://docs.google.com/spreadsheets/d/e/XXXX.../pub?output=csv
   ```

### Step 3 — Add URL to the website

Open `js/main.js` and replace the URL on line 3:

```js
const SHEET_CSV_URL = 'YOUR_PUBLISHED_CSV_URL_HERE';
```

### Step 4 — Google Drive Images

For images stored in Google Drive:

1. Upload image to Google Drive
2. Right-click → **Share → Anyone with the link can view**
3. Copy the share link: `https://drive.google.com/file/d/FILE_ID/view`
4. Paste directly into your sheet — the website converts it automatically

---

## 🚀 Deployment

### Deploy to GitHub + Vercel (Recommended)

**Step 1 — Push to GitHub**

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial SG Prime Living website"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/sg-prime-living.git
git branch -M main
git push -u origin main
```

**Step 2 — Deploy to Vercel**

1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub
2. Click **"Add New Project"**
3. Select your `sg-prime-living` repo
4. Leave all settings as default (Vercel auto-detects static)
5. Click **Deploy**
6. Your site will be live at `https://sg-prime-living.vercel.app` (or custom domain)

**Step 3 — Auto-deploy on every update**

From now on, every `git push` automatically deploys to Vercel. To update properties, just edit your Google Sheet — changes appear on the website immediately (no deployment needed).

---

### Deploy to GitHub Pages (Free Alternative)

1. Push to GitHub (Step 1 above)
2. Go to repo Settings → **Pages**
3. Source: **Deploy from a branch** → `main` → `/ (root)`
4. Click Save
5. Site will be live at `https://YOUR_USERNAME.github.io/sg-prime-living/`

---

## 🤖 AI Chat (Maya) Setup

The AI assistant is powered by the Anthropic Claude API. To enable it:

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. The current setup calls the API directly from the browser

> **Security Note:** For production, it's recommended to proxy the API call through a serverless function (Vercel Edge Function or Netlify Function) to keep your API key private. The current implementation works for demos.

### Optional: Secure API Key with Vercel Edge Function

Create `api/chat.js`:

```js
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { messages, system } = await req.json();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 400, system, messages }),
  });
  return new Response(await res.text(), { headers: { 'Content-Type': 'application/json' } });
}
```

Then set `ANTHROPIC_API_KEY` in Vercel Environment Variables.

---

## 🔄 Updating Properties

| What you want to change | How to do it |
|-------------------------|-------------|
| Add a new property | Add a row in Google Sheet → refreshes instantly |
| Update price or details | Edit the cell in Google Sheet |
| Change website branding | Edit `css/styles.css` (colors at top: `:root {}`) |
| Change contact info | Search for phone/email in `index.html` |
| Add testimonials | Find the `#testimonials` section in `index.html` |

---

## 🎨 Customization

### Change Brand Colors

Open `css/styles.css` and edit the `:root` block:

```css
:root {
  --rose: #C9735A;       /* Main accent color */
  --rose-dark: #A85B44;  /* Hover state */
  --charcoal: #1C1C1E;   /* Dark text & buttons */
  --cream: #FAF8F5;      /* Page background */
}
```

### Update Agent Info

Search and replace in `index.html`:
- `Shervyn S. Bacus` → Your name
- `9661833385` → Your phone
- `Sgprimeliving@gmail.com` → Your email
- `SGPrimeLiving` → Your Facebook page username

---

## 📱 Browser Support

- Chrome / Edge (latest)
- Firefox (latest)
- Safari 14+
- iOS Safari 14+
- Android Chrome

---

## 📄 License

Built for SG Prime Living. All rights reserved.
