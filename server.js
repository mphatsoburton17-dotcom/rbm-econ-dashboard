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
  yearlyAverages: [], explainerText: '', contactSettings: {}, faqLog: []
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Malawi Economic Indicators server running on port ${PORT}`);
});
