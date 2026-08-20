// ---- Monthly PDF Report ----
// Builds a gold-branded one-page summary PDF using the live dashboard data.
async function downloadReport() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const gold = [184, 134, 43];
  const goldDeep = [143, 102, 32];
  const ink = [38, 34, 24];
  const green = [46, 139, 69];
  const red = [196, 61, 61];

  const summary = await fetch('/api/summary').then(r => r.json());
  const entries = await fetch('/api/entries').then(r => r.json());
  const { latest, previous, policyRates, growthOutlook } = summary;

  doc.setFillColor(...goldDeep);
  doc.rect(0, 0, pageW, 90, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Malawi Economic Indicators', 40, 40);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Monthly Report — ${latest.label}`, 40, 62);
  doc.setFontSize(9);
  doc.text('Independent summary built from RBM/NSO published data', 40, 78);

  let y = 120;

  const kpis = [
    { label: 'Headline Inflation', value: latest.headline + '%', prev: previous ? previous.headline : null },
    { label: 'Food Inflation', value: (latest.food ?? '—') + '%', prev: previous ? previous.food : null },
    { label: 'Non-Food Inflation', value: (latest.nonFood ?? '—') + '%', prev: previous ? previous.nonFood : null },
  ];
  const boxW = (pageW - 80 - 20) / 3;
  kpis.forEach((k, i) => {
    const x = 40 + i * (boxW + 10);
    doc.setFillColor(251, 240, 218);
    doc.roundedRect(x, y, boxW, 70, 6, 6, 'F');
    doc.setTextColor(...goldDeep);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(k.label.toUpperCase(), x + 12, y + 20);
    doc.setTextColor(...ink);
    doc.setFontSize(20);
    doc.text(k.value, x + 12, y + 45);
    if (k.prev !== null) {
      const diff = +(parseFloat(k.value) - k.prev).toFixed(1);
      const arrow = diff > 0 ? '\u2191' : diff < 0 ? '\u2193' : '';
      doc.setTextColor(...(diff > 0 ? red : green));
      doc.setFontSize(9);
      doc.text(`${arrow} ${Math.abs(diff)}pp vs prior month`, x + 12, y + 60);
    }
  });

  y += 100;

  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Monetary Policy', 40, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Policy Rate: ${policyRates.policyRate}%   |   Lombard Rate: ${policyRates.lombardRate}%   |   2026 Growth Outlook: ${growthOutlook.projection2026}% (down from ${growthOutlook.previousProjection}%)`, 40, y);
  y += 30;

  doc.setFillColor(251, 243, 227);
  const explainerText = `Prices are still rising overall, but ${previous && latest.headline < previous.headline ? 'more slowly than last month' : 'have moved compared to last month'} — headline inflation is now ${latest.headline}%, with food at ${latest.food ?? '—'}% and non-food at ${latest.nonFood ?? '—'}%. This report reflects the Reserve Bank of Malawi's own published figures for ${latest.label}.`;
  const wrapped = doc.splitTextToSize(explainerText, pageW - 100);
  const boxH = wrapped.length * 14 + 20;
  doc.roundedRect(40, y, pageW - 80, boxH, 6, 6, 'F');
  doc.setTextColor(107, 92, 51);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.text(wrapped, 50, y + 18);
  y += boxH + 25;

  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Recent Monthly Data', 40, y);
  y += 18;

  doc.setFontSize(9);
  const colX = [40, 160, 260, 360];
  doc.setFillColor(...goldDeep);
  doc.rect(40, y, pageW - 80, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Month', colX[0] + 8, y + 14);
  doc.text('Headline', colX[1], y + 14);
  doc.text('Food', colX[2], y + 14);
  doc.text('Non-Food', colX[3], y + 14);
  y += 20;

  const recent = entries.slice().reverse().slice(0, 8);
  doc.setFont('helvetica', 'normal');
  recent.forEach((r, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 246, i % 2 === 0 ? 255 : 236);
    doc.rect(40, y, pageW - 80, 18, 'F');
    doc.setTextColor(...ink);
    doc.text(r.label, colX[0] + 8, y + 13);
    doc.text(r.headline + '%', colX[1], y + 13);
    doc.text((r.food ?? '—') + '%', colX[2], y + 13);
    doc.text((r.nonFood ?? '—') + '%', colX[3], y + 13);
    y += 18;
  });

  y += 20;

  doc.setDrawColor(...gold);
  doc.setLineWidth(1);
  doc.line(40, y, pageW - 40, y);
  y += 16;
  doc.setFontSize(8);
  doc.setTextColor(150, 140, 110);
  const disclaimer = 'Independent, unofficial report built from the Reserve Bank of Malawi\'s own published releases. Not affiliated with or endorsed by RBM. Figures may be revised by RBM after first publication. reserve-bank@rbm.mw | www.rbm.mw | Toll-free 459';
  doc.text(doc.splitTextToSize(disclaimer, pageW - 80), 40, y);

  doc.save(`malawi-inflation-report-${latest.month}.pdf`);
}
