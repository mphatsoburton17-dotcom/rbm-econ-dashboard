// Malawi Economic Indicators Dashboard — backend
// Serves real inflation/policy-rate data to the public dashboard,
// and lets an admin add each new month's release through a simple protected form.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const adapter = new FileSync(path.join(__dirname, 'db.json'));
const db = low(adapter);

// Defaults, in case db.json is ever empty
db.defaults({ entries: [], policyRates: {}, urbanRural: {}, growthOutlook: {} }).write();

const app = express();
app.use(cors());
app.use(express.json());

// Serve the frontend (the /public folder) as static files
app.use(express.static(__dirname));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-this-password';

// ---------- PUBLIC API (no login needed — this is what the dashboard reads) ----------

// All monthly inflation entries, oldest to newest
app.get('/api/entries', (req, res) => {
  const entries = db.get('entries').sortBy('month').value();
  res.json(entries);
});

// Yearly averages — multi-year view
app.get('/api/yearly', (req, res) => {
  res.json(db.get('yearlyAverages').value());
});

app.get('/api/summary', (req, res) => {
  const entries = db.get('entries').sortBy('month').value();
  const latest = entries[entries.length - 1] || null;
  const previous = entries[entries.length - 2] || null;

  res.json({
    latest,
    previous,
    policyRates: db.get('policyRates').value(),
    urbanRural: db.get('urbanRural').value(),
    growthOutlook: db.get('growthOutlook').value(),
  });
});

// ---------- ADMIN (password-protected — this is how you add each new month) ----------

function requireAdmin(req, res, next) {
  const password = req.headers['x-admin-password'];
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect admin password.' });
  }
  next();
}

// Check a password without changing anything (used by the admin login form)
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false, error: 'Incorrect password.' });
});

// Add or update one month's entry — this is the monthly task once a new RBM release is out
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

// Update policy rates / urban-rural / growth outlook (the smaller panels)
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Malawi Economic Indicators server running on port ${PORT}`);
});
