// Malawi Economic Indicators Dashboard — backend
// Serves real inflation/policy-rate data to the public dashboard,
// and lets an admin manage everything through a protected admin panel.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);

db.defaults({
  entries: [], policyRates: {}, urbanRural: {}, growthOutlook: {},
  yearlyAverages: [], explainerText: '', contactSettings: {}, faqLog: [],
  exchangeRates: [], tbills: [], omo: [], foreignReserves: [], news: [],
  masiIndex: [], listedStocks: [], mpcMeetings: [], mpcNext: {}
}).write();

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

// ================= PUBLIC API =================

app.get('/api/entries', (req, res) => {
  res.json(db.get('entries').sortBy('month').value());
});

app.get('/api/yearly', (req, res) => {
  res.json(db.get('yearlyAverages').value());
});

app.get('/api/explainer', (req, res) => {
  res.json({ text: db.get('explainerText').value() });
});

app.get('/api/contact', (req, res) => {
  res.json(db.get('contactSettings').value());
});

app.get('/api/summary', (req, res) => {
  const entries = db.get('entries').sortBy('month').value();
  const latest = entries[entries.length - 1] || null;
  const previous = entries[entries.length - 2] || null;
  res.json({
    latest, previous,
    policyRates: db.get('policyRates').value(),
    urbanRural: db.get('urbanRural').value(),
    growthOutlook: db.get('growthOutlook').value(),
  });
});

// Visitor submits a question from the FAQ chat widget — logged for review, no login needed
app.post('/api/faq-log', (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'question is required' });
  db.get('faqLog').push({ question, answeredByBot: true, timestamp: new Date().toISOString() }).write();
  res.json({ ok: true });
});

// ================= ADMIN API (all require the password header) =================

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ ok: false, error: 'Incorrect password.' });
});

// -- Monthly entries: add/update, delete, bulk import, CSV export --

app.post('/api/admin/entries', requireAdmin, (req, res) => {
  const { month, label, headline, food, nonFood, source } = req.body;
  if (!month || !label || headline === undefined) {
    return res.status(400).json({ error: 'month, label, and headline are required.' });
  }
  const existing = db.get('entries').find({ month }).value();
  if (existing) {
    db.get('entries').find({ month }).assign({ label, headline, food, nonFood, source }).write();
  } else {
    db.get('entries').push({ month, label, headline, food, nonFood, source }).write();
  }
  res.json({ ok: true });
});

app.delete('/api/admin/entries/:month', requireAdmin, (req, res) => {
  db.get('entries').remove({ month: req.params.month }).write();
  res.json({ ok: true });
});

app.post('/api/admin/entries/bulk', requireAdmin, (req, res) => {
  const { rows } = req.body; // array of {month,label,headline,food,nonFood,source}
  if (!Array.isArray(rows)) return res.status(400).json({ error: 'rows must be an array' });
  rows.forEach(r => {
    if (!r.month || !r.label || r.headline === undefined) return;
    const existing = db.get('entries').find({ month: r.month }).value();
    if (existing) {
      db.get('entries').find({ month: r.month }).assign(r).write();
    } else {
      db.get('entries').push(r).write();
    }
  });
  res.json({ ok: true, count: rows.length });
});

app.get('/api/admin/export', requireAdmin, (req, res) => {
  const entries = db.get('entries').sortBy('month').value();
  const header = 'month,label,headline,food,nonFood,source';
  const rows = entries.map(r => [r.month, r.label, r.headline, r.food ?? '', r.nonFood ?? '', (r.source || '').replace(/,/g, ';')].join(','));
  const csv = [header, ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="inflation-data.csv"');
  res.send(csv);
});

// -- Other indicators (policy rates, urban/rural, growth outlook) --

app.post('/api/admin/policy-rates', requireAdmin, (req, res) => {
  db.set('policyRates', req.body).write();
  res.json({ ok: true });
});

app.post('/api/admin/urban-rural', requireAdmin, (req, res) => {
  db.set('urbanRural', req.body).write();
  res.json({ ok: true });
});

app.post('/api/admin/growth-outlook', requireAdmin, (req, res) => {
  db.set('growthOutlook', req.body).write();
  res.json({ ok: true });
});

// -- Yearly averages --

app.post('/api/admin/yearly', requireAdmin, (req, res) => {
  const { yearlyAverages } = req.body;
  if (!Array.isArray(yearlyAverages)) return res.status(400).json({ error: 'yearlyAverages must be an array' });
  db.set('yearlyAverages', yearlyAverages).write();
  res.json({ ok: true });
});

// -- "What this means" explainer text --

app.post('/api/admin/explainer', requireAdmin, (req, res) => {
  const { text } = req.body;
  db.set('explainerText', text || '').write();
  res.json({ ok: true });
});

// -- FAQ inbox --

app.get('/api/admin/faq-log', requireAdmin, (req, res) => {
  res.json(db.get('faqLog').value());
});

app.delete('/api/admin/faq-log/:index', requireAdmin, (req, res) => {
  const idx = parseInt(req.params.index, 10);
  const log = db.get('faqLog').value();
  log.splice(idx, 1);
  db.set('faqLog', log).write();
  res.json({ ok: true });
});

// -- Contact & settings --

app.post('/api/admin/contact', requireAdmin, (req, res) => {
  db.set('contactSettings', req.body).write();
  res.json({ ok: true });
});


// ================= FINANCIAL MARKETS PANELS =================

// ---- Exchange Rates ----
app.get('/api/exchange-rates', (req, res) => {
  res.json(db.get('exchangeRates').sortBy('date').value());
});

app.post('/api/admin/exchange-rates', requireAdmin, (req, res) => {
  const { date, usd, gbp, zar, source } = req.body;
  if (!date || usd === undefined) return res.status(400).json({ error: 'date and usd are required' });
  const existing = db.get('exchangeRates').find({ date }).value();
  if (existing) {
    db.get('exchangeRates').find({ date }).assign({ usd, gbp, zar, source }).write();
  } else {
    db.get('exchangeRates').push({ date, usd, gbp, zar, source }).write();
  }
  res.json({ ok: true });
});

app.delete('/api/admin/exchange-rates/:date', requireAdmin, (req, res) => {
  db.get('exchangeRates').remove({ date: req.params.date }).write();
  res.json({ ok: true });
});

// Auto-fetch endpoint — call this from an external scheduler (e.g. cron-job.org) once a day.
// Pulls live USD/GBP/ZAR -> MWK rates from the free open.er-api.com feed and saves a new entry.
app.get('/api/fetch-exchange-rate', async (req, res) => {
  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await response.json();
    if (!data.rates || !data.rates.MWK) throw new Error('MWK rate not found in response');

    const usdToMwk = data.rates.MWK;
    const gbpToMwk = data.rates.GBP ? usdToMwk / data.rates.GBP : null;
    const zarToMwk = data.rates.ZAR ? usdToMwk / data.rates.ZAR : null;
    const today = new Date().toISOString().slice(0, 10);

    const existing = db.get('exchangeRates').find({ date: today }).value();
    const entry = { date: today, usd: +usdToMwk.toFixed(2), gbp: gbpToMwk ? +gbpToMwk.toFixed(2) : null, zar: zarToMwk ? +zarToMwk.toFixed(2) : null, source: 'open.er-api.com (auto-fetched)' };
    if (existing) {
      db.get('exchangeRates').find({ date: today }).assign(entry).write();
    } else {
      db.get('exchangeRates').push(entry).write();
    }
    res.json({ ok: true, entry });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---- Treasury Bill / Bond Yields ----
app.get('/api/tbills', (req, res) => {
  res.json(db.get('tbills').value());
});

app.post('/api/admin/tbills', requireAdmin, (req, res) => {
  db.get('tbills').push(req.body).write();
  res.json({ ok: true });
});

app.delete('/api/admin/tbills/:index', requireAdmin, (req, res) => {
  const idx = parseInt(req.params.index, 10);
  const rows = db.get('tbills').value();
  rows.splice(idx, 1);
  db.set('tbills', rows).write();
  res.json({ ok: true });
});

// ---- Open Market Operations / Liquidity ----
app.get('/api/omo', (req, res) => {
  res.json(db.get('omo').sortBy('date').value());
});

app.post('/api/admin/omo', requireAdmin, (req, res) => {
  db.get('omo').push(req.body).write();
  res.json({ ok: true });
});

app.delete('/api/admin/omo/:index', requireAdmin, (req, res) => {
  const idx = parseInt(req.params.index, 10);
  const rows = db.get('omo').value();
  rows.splice(idx, 1);
  db.set('omo', rows).write();
  res.json({ ok: true });
});

// ---- Foreign Reserves ----
app.get('/api/reserves', (req, res) => {
  res.json(db.get('foreignReserves').sortBy('month').value());
});

app.post('/api/admin/reserves', requireAdmin, (req, res) => {
  const { month, amountUSD, source, monthlyImportBillUSD, importBillSource } = req.body;
  const existing = db.get('foreignReserves').find({ month }).value();
  const entry = { month, amountUSD, source, monthlyImportBillUSD, importBillSource };
  if (existing) {
    db.get('foreignReserves').find({ month }).assign(entry).write();
  } else {
    db.get('foreignReserves').push(entry).write();
  }
  res.json({ ok: true });
});

app.delete('/api/admin/reserves/:month', requireAdmin, (req, res) => {
  db.get('foreignReserves').remove({ month: req.params.month }).write();
  res.json({ ok: true });
});


// ================= STOCK MARKET (Malawi Stock Exchange) =================
// Manually entered, same pattern as reserves/tbills — MSE's own data terms
// restrict automated republishing, so figures are entered by hand each update
// and always carry a source citation (e.g. "MSE daily trading summary, 22 Aug 2026").

// ---- MASI (Malawi All Share Index) history ----
app.get('/api/masi', (req, res) => {
  res.json(db.get('masiIndex').sortBy('date').value());
});

app.post('/api/admin/masi', requireAdmin, (req, res) => {
  const { date, value, weeklyChangePct, ytdChangePct, source } = req.body;
  if (!date || value === undefined) return res.status(400).json({ error: 'date and value are required' });
  const existing = db.get('masiIndex').find({ date }).value();
  const entry = { date, value, weeklyChangePct, ytdChangePct, source };
  if (existing) {
    db.get('masiIndex').find({ date }).assign(entry).write();
  } else {
    db.get('masiIndex').push(entry).write();
  }
  res.json({ ok: true });
});

app.delete('/api/admin/masi/:date', requireAdmin, (req, res) => {
  db.get('masiIndex').remove({ date: req.params.date }).write();
  res.json({ ok: true });
});

// ---- Individual listed companies (current snapshot, one row per ticker) ----
app.get('/api/stocks', (req, res) => {
  res.json(db.get('listedStocks').value());
});

app.post('/api/admin/stocks', requireAdmin, (req, res) => {
  const { ticker, name, price, changePct, date, source } = req.body;
  if (!ticker || !name || price === undefined) {
    return res.status(400).json({ error: 'ticker, name, and price are required' });
  }
  const existing = db.get('listedStocks').find({ ticker }).value();
  const entry = { ticker, name, price, changePct, date, source };
  if (existing) {
    db.get('listedStocks').find({ ticker }).assign(entry).write();
  } else {
    db.get('listedStocks').push(entry).write();
  }
  res.json({ ok: true });
});

app.delete('/api/admin/stocks/:ticker', requireAdmin, (req, res) => {
  db.get('listedStocks').remove({ ticker: req.params.ticker }).write();
  res.json({ ok: true });
});


// ================= NEWS & ANNOUNCEMENTS =================

app.get('/api/news', (req, res) => {
  res.json(db.get('news').value() || []);
});

app.post('/api/admin/news', requireAdmin, (req, res) => {
  const { title, summary, link, date } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'title and date are required' });
  db.get('news').push({ title, summary, link, date }).write();
  res.json({ ok: true });
});

app.delete('/api/admin/news/:index', requireAdmin, (req, res) => {
  const idx = parseInt(req.params.index, 10);
  const rows = db.get('news').value() || [];
  rows.splice(idx, 1);
  db.set('news', rows).write();
  res.json({ ok: true });
});

// ================= MPC MEETING TRACKER =================

app.get('/api/mpc', (req, res) => {
  res.json(db.get('mpcMeetings').sortBy('date').value());
});

app.post('/api/admin/mpc', requireAdmin, (req, res) => {
  const { date, decision, changeBps, reason, source, link } = req.body;
  if (!date || !decision || !reason) {
    return res.status(400).json({ error: 'date, decision, and reason are required.' });
  }
  db.get('mpcMeetings').push({ date, decision, changeBps, reason, source, link }).write();
  res.json({ ok: true });
});

app.delete('/api/admin/mpc/:index', requireAdmin, (req, res) => {
  const idx = parseInt(req.params.index, 10);
  const rows = db.get('mpcMeetings').value();
  rows.splice(idx, 1);
  db.set('mpcMeetings', rows).write();
  res.json({ ok: true });
});

app.get('/api/mpc-next', (req, res) => {
  res.json(db.get('mpcNext').value() || {});
});

app.post('/api/admin/mpc-next', requireAdmin, (req, res) => {
  const { nextMeetingDate } = req.body;
  db.set('mpcNext', { nextMeetingDate }).write();
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Malawi Economic Indicators server running on port ${PORT}`);
});
