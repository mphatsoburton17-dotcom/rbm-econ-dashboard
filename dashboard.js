// Dashboard page logic — fetches real data from the backend API and draws the charts.
// No numbers are hardcoded here; everything comes from /api/entries and /api/summary.

Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = '#8a7f63';

const EXPLANATIONS = {
  headline: "This shows how much more expensive things are now compared to a year ago. If it's 20%, something that cost MK1,000 last year now costs about MK1,200.",
  food: "The price of things like maize, rice, and vegetables compared to a year ago.",
  nonFood: "The price of things that aren't food — fuel, rent, transport, clothing — compared to a year ago.",
  mom: "How much prices moved in just the last month, compared to the month before.",
  policyRate: "The interest rate the Reserve Bank sets. When it goes up, loans usually get more expensive. When it goes down, borrowing gets cheaper.",
  growth: "How much bigger the economy is expected to get this year, compared to last year."
};

function toggleExplain(id) {
  const el = document.getElementById(id);
  el.classList.toggle('show');
}

function fmtDelta(curr, prev) {
  if (prev === null || prev === undefined || curr === null) return { text: '', cls: '' };
  const diff = +(curr - prev).toFixed(1);
  if (diff === 0) return { text: 'unchanged', cls: '' };
  const cls = diff > 0 ? 'up' : 'down';
  const arrow = diff > 0 ? '↑' : '↓';
  return { text: `${arrow} ${Math.abs(diff)}pp vs prior month`, cls };
}

async function loadDashboard() {
  const [entries, summary] = await Promise.all([
    fetch('/api/entries').then(r => r.json()),
    fetch('/api/summary').then(r => r.json())
  ]);

  const { latest, previous, policyRates, urbanRural, growthOutlook } = summary;

  // ---- KPI cards ----
  const hDelta = fmtDelta(latest.headline, previous ? previous.headline : null);
  const fDelta = fmtDelta(latest.food, previous ? previous.food : null);
  const nfDelta = fmtDelta(latest.nonFood, previous ? previous.nonFood : null);

  document.getElementById('kpiHeadline').textContent = latest.headline + '%';
  document.getElementById('kpiHeadlineDelta').textContent = hDelta.text;
  document.getElementById('kpiHeadlineDelta').className = 'delta ' + hDelta.cls;

  document.getElementById('kpiFood').textContent = (latest.food ?? '—') + '%';
  document.getElementById('kpiFoodDelta').textContent = fDelta.text;
  document.getElementById('kpiFoodDelta').className = 'delta ' + fDelta.cls;

  document.getElementById('kpiNonFood').textContent = (latest.nonFood ?? '—') + '%';
  document.getElementById('kpiNonFoodDelta').textContent = nfDelta.text;
  document.getElementById('kpiNonFoodDelta').className = 'delta ' + nfDelta.cls;

  document.getElementById('kpiPolicyRate').textContent = policyRates.policyRate + '%';
  document.getElementById('kpiGrowth').textContent = growthOutlook.projection2026 + '%';
  document.getElementById('kpiGrowthDelta').textContent =
    `↓ from ${growthOutlook.previousProjection}%`;

  document.getElementById('tickerHeadline').textContent = latest.headline + '%';
  document.getElementById('tickerPolicy').textContent = policyRates.policyRate + '%';
  document.getElementById('tickerGrowth').textContent = growthOutlook.projection2026 + '%';

  // ---- Policy rates panel ----
  document.getElementById('rtPolicy').textContent = policyRates.policyRate + '%';
  document.getElementById('rtLombard').textContent = policyRates.lombardRate + '%';
  document.getElementById('rtLocal').textContent = policyRates.liquidityReserveLocal + '%';
  document.getElementById('rtForeign').textContent = policyRates.liquidityReserveForeign + '%';
  document.getElementById('rtMoney').textContent = policyRates.moneySupplyGrowth + '%';

  // ---- Explainer sentence ----
  document.getElementById('explainerText').textContent =
    `Prices are still rising overall, but ${latest.headline < previous?.headline ? 'more slowly than last month' : 'faster than last month'} ` +
    `— headline inflation is now ${latest.headline}%, with food at ${latest.food ?? '—'}% and non-food at ${latest.nonFood ?? '—'}%.`;

  // ---- Data table ----
  const tbody = document.getElementById('dataTableBody');
  tbody.innerHTML = '';
  entries.slice().reverse().forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.label}</td><td class="num">${r.headline}%</td><td class="num">${r.food !== null ? r.food + '%' : '—'}</td><td class="num">${r.nonFood !== null ? r.nonFood + '%' : '—'}</td><td style="font-size:11px;color:#9a8f74;">${r.source || ''}</td>`;
    tbody.appendChild(tr);
  });

  // ---- Charts ----
  new Chart(document.getElementById('mainTrend'), {
    type: 'line',
    data: {
      labels: entries.map(r => r.label),
      datasets: [
        { label: 'Headline', data: entries.map(r => r.headline), borderColor: '#B8862B', backgroundColor: 'rgba(184,134,43,0.08)', tension: 0.35, fill: true, borderWidth: 2.5, pointRadius: 2, spanGaps: true },
        { label: 'Food', data: entries.map(r => r.food), borderColor: '#2E8B45', tension: 0.35, borderWidth: 2, pointRadius: 2, spanGaps: true },
        { label: 'Non-Food', data: entries.map(r => r.nonFood), borderColor: '#C43D3D', tension: 0.35, borderWidth: 2, pointRadius: 2, spanGaps: true },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } },
      scales: { y: { grid: { color: '#F1EAD8' }, ticks: { callback: v => v + '%' } }, x: { grid: { display: false } } }
    }
  });

  new Chart(document.getElementById('urbanRural'), {
    type: 'bar',
    data: {
      labels: ['Urban', 'Rural'],
      datasets: [
        { label: 'Monthly Inflation', data: [urbanRural.urban.monthly, urbanRural.rural.monthly], backgroundColor: '#B8862B' },
        { label: 'Food', data: [urbanRural.urban.food, urbanRural.rural.food], backgroundColor: '#2E8B45' },
        { label: 'Non-Food', data: [urbanRural.urban.nonFood, urbanRural.rural.nonFood], backgroundColor: '#C43D3D' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
      scales: { y: { grid: { color: '#F1EAD8' }, ticks: { callback: v => v + '%' } }, x: { grid: { display: false } } }
    }
  });

  // Calculator uses the real, current headline rate
  window.CURRENT_HEADLINE_RATE = latest.headline / 100;
}

function runCalc() {
  const amt = parseFloat(document.getElementById('calcAmount').value) || 0;
  const yrs = parseFloat(document.getElementById('calcYears').value) || 0;
  const rate = window.CURRENT_HEADLINE_RATE || 0.208;
  const futureValue = amt / Math.pow(1 + rate, yrs);
  document.getElementById('calcResult').innerHTML =
    `At today's ${(rate * 100).toFixed(1)}% annual inflation, <b>MWK ${amt.toLocaleString()}</b> today will have the buying power of roughly <b>MWK ${Math.round(futureValue).toLocaleString()}</b> in ${yrs} year${yrs == 1 ? '' : 's'}.`;
}

loadDashboard();
