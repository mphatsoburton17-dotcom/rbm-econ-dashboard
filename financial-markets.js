// Financial Markets panels — Exchange Rate, T-Bill Yields, OMO status, Foreign Reserves.
// Fetches from the public API and renders into the containers added on index.html.

async function loadFinancialMarkets() {
  const [fx, tbills, omo, reserves] = await Promise.all([
    fetch('/api/exchange-rates').then(r => r.json()),
    fetch('/api/tbills').then(r => r.json()),
    fetch('/api/omo').then(r => r.json()),
    fetch('/api/reserves').then(r => r.json()),
  ]);

  // ---- Exchange Rate card ----
  if (fx.length) {
    const latest = fx[fx.length - 1];
    const prev = fx[fx.length - 2];
    document.getElementById('fxValue').textContent = latest.usd.toLocaleString() + ' MWK';
    if (prev) {
      const diff = +(latest.usd - prev.usd).toFixed(2);
      const pct = ((diff / prev.usd) * 100).toFixed(2);
      const el = document.getElementById('fxDelta');
      el.textContent = `${diff > 0 ? '↑' : diff < 0 ? '↓' : ''} ${Math.abs(pct)}% vs prior entry`;
      el.className = 'delta ' + (diff > 0 ? 'up' : 'down');
    }
    new Chart(document.getElementById('fxChart'), {
      type: 'line',
      data: { labels: fx.map(f => f.date), datasets: [{ label: 'USD/MWK', data: fx.map(f => f.usd), borderColor: '#B8862B', backgroundColor: 'rgba(184,134,43,0.08)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { y: { grid: { color: '#F1EAD8' } }, x: { grid: { display: false } } } }
    });
  }

  // ---- Foreign Reserves card ----
  if (reserves.length) {
    const latest = reserves[reserves.length - 1];
    const prev = reserves[reserves.length - 2];
    document.getElementById('reservesValue').textContent = '$' + (latest.amountUSD / 1000000).toFixed(0) + 'M';
    if (prev) {
      const diff = latest.amountUSD - prev.amountUSD;
      const el = document.getElementById('reservesDelta');
      el.textContent = `${diff > 0 ? '↑' : diff < 0 ? '↓' : ''} ${Math.abs(diff / 1000000).toFixed(1)}M vs prior month`;
      el.className = 'delta ' + (diff > 0 ? 'down' : 'up'); // more reserves = good, styled green
    }
  }

  // ---- T-Bill yields table ----
  const tbBody = document.getElementById('tbillTable');
  if (tbBody) {
    tbBody.innerHTML = '';
    tbills.forEach(t => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${t.tenor}</td><td class="num">${t.yield}%</td><td style="font-size:11px;color:#9a8f74;">${t.date}</td>`;
      tbBody.appendChild(tr);
    });
  }

  // ---- OMO status badge ----
  if (omo.length) {
    const latest = omo[omo.length - 1];
    document.getElementById('omoStatus').textContent = 'RBM is currently: ' + latest.action;
  }
}

document.addEventListener('DOMContentLoaded', loadFinancialMarkets);

