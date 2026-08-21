// Malawi Economic Indicators Dashboard — backend
// Now stores data in Postgres (via DATABASE_URL) instead of a local file,
// so saved data survives redeploys.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const DEFAULT_STATE = {
  entries: [], policyRates: {}, urbanRural: {}, growthOutlook: {},
  yearlyAverages: [], explainerText: '', contactSettings: {}, faqLog: [],
  exchangeRates: [], tbills: [], omo: [], foreignReserves: []
};

let state = DEFAULT_STATE;

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS rbm_store (key TEXT PRIMARY KEY, data JSONB)`);
  const res = await pool.query(`SELECT data FROM rbm_store WHERE key = 'main'`);
  if (res.rows.length) {
    state = { ...DEFAULT_STATE, ...res.rows[0].data };
  } else {
    await pool.query(`INSERT INTO rbm_store (key, data) VALUES ('main', $1)`, [state]);
  }
}

async function saveState() {
  await pool.query(`UPDATE rbm_store SET data = $1 WHERE key = 'main'`, [state]);
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-this-password';

function requireAdmin(req, res, next) {
  const password = req.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }
  next();
}

function sortByMonth(arr) {
  return [...arr].sort((a, b) => (a.month > b.month ? 1 : a.month < b.month ? -1 : 0));
}
function sortByDate(arr) {
  return [...arr].sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
}

// ================= PUBLIC API =================

app.get('/api/entries', (req, res) => {
  res.json(sortByMonth(state.entries));
});

app.get('/api/yearly', (req, res) => {
  res.json(state.yearlyAverages);
});

app.get('/api/explainer', (req, res) => {
  res.json({ text: state.explainerText });
});

app.get('/api/contact', (req, res) => {
  res.json(state.contactSettings);
});

app.get('/api/summary', (req, res) => {
  const entries = sortByMonth(state.entries);
  const latest = entries[entries.length - 1] || null;
  const previous = entries[entries.length - 2] || null;
  res.json({
    latest, previous,
    policyRates: state.policyRates,
    urbanRural: state.urbanRural,
    growthOutlook: state.growthOutlook,
  });
});

app.post('/api/faq-log', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'question is required' });
  state.faqLog.push({ question, answeredByBot: true, timestamp: new Date().toISOString() });
  await saveState();
  res.json({ ok: true });
});

// ================= ADMIN API =================

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ ok: false, error: 'Incorrect password.' });
});

app.post('/api/admin/entries', requireAdmin, async (req, res) => {
  const { month, label, headline, food, nonFood, source } = req.body;
  if (!month || !label || headline === undefined) {
    return res.status(400).json({ error: 'month, label, and headline are required.' });
  }
  const idx = state.entries.findIndex(e => e.month === month);
  const entry = { month, label, headline, food, nonFood, source };
  if (idx >= 0) state.entries[idx] = entry; else state.entries.push(entry);
  await saveState();
  res.json({ ok: true });
});

app.delete('/api/admin/entries/:month', requireAdmin, async (req, res) => {
  state.entries = state.entries.filter(e => e.month !== req.params.month);
  await saveState();
  res.json({ ok: true });
});

app.post('/api/admin/entries/bulk', requireAdmin, async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array' });
  rows.forEach(r => {
    if (!r.month || !r.label || r.headline === undefined) return;
    const idx = state.entries.findIndex(e => e.month === r.month);
    if (idx >= 0) state.entries[idx] = r; else state.entries.push(r);
  });
  await saveState();
  res.json({ ok: true, count: rows.length });
});

app.get('/api/admin/export', requireAdmin, (req, res) => {
  const entries = sortByMonth(state.entries);
  const header = 'month,label,headline,food,nonFood,source';
  const rows = entries.map(r => [r.month, r.label, r.headline, r.food ?? '', r.nonFood ?? '', (r.source || '').replace(/,/g, ';')].join(','));
  const csv = [header, ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="inflation-data.csv"');
  res.send(csv);
});

app.post('/api/admin/policy-rates', requireAdmin, async (req, res) => {
  state.policyRates = req.body;
  await saveState();
  res.json({ ok: true });
});

app.post('/api/admin/urban-rural', requireAdmin, async (req, res) => {
  state.urbanRural = req.body;
  await saveState();
  res.json({ ok: true });
});

app.post('/api/admin/growth-outlook', requireAdmin, async (req, res) => {
  state.growthOutlook = req.body;
  await saveState();
  res.json({ ok: true });
});

app.post('/api/admin/yearly', requireAdmin, async (req, res) => {
  const { yearlyAverages } = req.body;
  if (!Array.isArray(yearlyAverages)) return res.status(400).json({ error: 'yearlyAverages must be an array' });
  state.yearlyAverages = yearlyAverages;
  await saveState();
  res.json({ ok: true });
});

app.post('/api/admin/explainer', requireAdmin, async (req, res) => {
  const { text } = req.body;
  state.explainerText = text || '';
  await saveState();
  res.json({ ok: true });
});

app.get('/api/admin/faq-log', requireAdmin, (req, res) => {
  res.json(state.faqLog);
});

app.delete('/api/admin/faq-log/:index', requireAdmin, async (req, res) => {
  const idx = parseInt(req.params.index, 10);
  state.faqLog.splice(idx, 1);
  await saveState();
  res.json({ ok: true });
});

app.post('/api/admin/contact', requireAdmin, async (req, res) => {
  state.contactSettings = req.body;
  await saveState();
  res.json({ ok: true });
});

// ================= FINANCIAL MARKETS PANELS =================

app.get('/api/exchange-rates', (req, res) => {
  res.json(sortByDate(state.exchangeRates));
});

app.post('/api/admin/exchange-rates', requireAdmin, async (req, res) => {
  const { date, usd, gbp, zar, source } = req.body;
  if (!date || usd === undefined) return res.status(400).json({ error: 'date and usd are required' });
  const idx = state.exchangeRates.findIndex(e => e.date === date);
  const entry = { date, usd, gbp, zar, source };
  if (idx >= 0) state.exchangeRates[idx] = entry; else state.exchangeRates.push(entry);
  await saveState();
  res.json({ ok: true });
});

app.delete('/api/admin/exchange-rates/:date', requireAdmin, async (req, res) => {
  state.exchangeRates = state.exchangeRates.filter(e => e.date !== req.params.date);
  await saveState();
  res.json({ ok: true });
});

app.get('/api/fetch-exchange-rate', async (req, res) => {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await response.json();
    if (!data.rates || !data.rates.MWK) throw new Error('MWK rate not found in response');

    const usdToMwk = data.rates.MWK;
    const gbpToMwk = data.rates.GBP ? usdToMwk / data.rates.GBP : null;
    const zarToMwk = data.rates.ZAR ? usdToMwk / data.rates.ZAR : null;
    const today = new Date().toISOString().slice(0, 10);

    const entry = { date: today, usd: +usdToMwk.toFixed(2), gbp: gbpToMwk ? +gbpToMwk.toFixed(2) : null, zar: zarToMwk ? +zarToMwk.toFixed(2) : null, source: 'open.er-api.com (auto-fetched)' };
    const idx = state.exchangeRates.findIndex(e => e.date === today);
    if (idx >= 0) state.exchangeRates[idx] = entry; else state.exchangeRates.push(entry);
    await saveState();
    res.json({ ok: true, entry });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/tbills', (req, res) => {
  res.json(state.tbills);
});

app.post('/api/admin/tbills', requireAdmin, async (req, res) => {
  state.tbills.push(req.body);
  await saveState();
  res.json({ ok: true });
});

app.delete('/api/admin/tbills/:index', requireAdmin, async (req, res) => {
  const idx = parseInt(req.params.index, 10);
  state.tbills.splice(idx, 1);
  await saveState();
  res.json({ ok: true });
});

app.get('/api/omo', (req, res) => {
  res.json(sortByDate(state.omo));
});

app.post('/api/admin/omo', requireAdmin, async (req, res) => {
  state.omo.push(req.body);
  await saveState();
  res.json({ ok: true });
});

app.delete('/api/admin/omo/:index', requireAdmin, async (req, res) => {
  const idx = parseInt(req.params.index, 10);
  state.omo.splice(idx, 1);
  await saveState();
  res.json({ ok: true });
});

app.get('/api/reserves', (req, res) => {
  res.json(sortByMonth(state.foreignReserves));
});

app.post('/api/admin/reserves', requireAdmin, async (req, res) => {
  const { month, amountUSD, source } = req.body;
  const idx = state.foreignReserves.findIndex(r => r.month === month);
  const entry = { month, amountUSD, source };
  if (idx >= 0) state.foreignReserves[idx] = entry; else state.foreignReserves.push(entry);
  await saveState();
  res.json({ ok: true });
});

app.delete('/api/admin/reserves/:month', requireAdmin, async (req, res) => {
  state.foreignReserves = state.foreignReserves.filter(r => r.month !== req.params.month);
  await saveState();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Malawi Economic Indicators server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to connect to database:', err);
  process.exit(1);
});
