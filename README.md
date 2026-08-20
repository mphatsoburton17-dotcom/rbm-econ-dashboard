# Malawi Economic Indicators — Dashboard

An interactive public dashboard built from the Reserve Bank of Malawi's own
published data (Consumer Price Indices, MPC Dashboard releases). Independent
prototype — not affiliated with or endorsed by RBM.

## What's in this project

```
rbm-econ-dashboard/
├── backend/
│   ├── server.js         → the API server (Express)
│   ├── package.json      → backend dependencies
│   ├── .env.example      → copy to .env and set your admin password
│   └── data/db.json      → the database file (real seeded data included)
└── public/                → the website itself (served by the backend)
    ├── index.html          → main dashboard
    ├── learn.html          → plain-language explanations (EN/Chichewa)
    ├── about.html          → project info
    ├── sources.html        → data citations
    ├── admin.html          → password-protected page to add new months
    ├── css/style.css
    └── js/dashboard.js
```

## How the monthly update works

Once a month, RBM publishes new inflation figures. You:

1. Open `yourdomain.com/admin.html`
2. Log in with your admin password
3. Type in the new month's headline / food / non-food inflation and where you got it
4. Click Save — the public dashboard updates immediately, no code changes needed

That's the whole "system" part — a small database behind the site, and a
simple form only you can access to keep it current.

## Running it locally (to test before deploying)

You'll need [Node.js](https://nodejs.org) installed (free).

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and change `ADMIN_PASSWORD` to something only you know. Then:

```bash
npm start
```

Visit `http://localhost:3000` in your browser — the dashboard should load
with the real seeded data. Visit `http://localhost:3000/admin.html` to try
adding a new month.

## Deploying it live (so you have a real link to share)

**Recommended: Render (free tier to start)**

1. Push this folder to a new GitHub repository
2. Go to [render.com](https://render.com), sign up free, click "New Web Service"
3. Connect your GitHub repo
4. Set:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under "Environment," add `ADMIN_PASSWORD` with your chosen password
6. Deploy — Render gives you a live URL like `your-project.onrender.com`

**Optional: custom domain**

Buy a domain (e.g. from Namecheap, ~$10–15/year) and point it at your Render
service under Render's "Custom Domain" settings.

## Important notes

- The included `data/db.json` already has 10 months of **real** inflation
  data (Oct 2025–Jul 2026), sourced from RBM/NSO releases and reported by
  Trading Economics and The Nation — see `public/sources.html`.
- The free Render tier "sleeps" the app after inactivity — the first visit
  after a while takes a few seconds to wake up. Fine for early sharing; a
  paid tier (~$7/month) removes this once you have regular visitors.
- Change the default admin password before sharing this link with anyone.
