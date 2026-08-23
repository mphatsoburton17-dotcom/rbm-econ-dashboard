// Simple, free, rule-based assistant — used as a fallback if the AI assistant
// (Gemini, via /api/faq-ask) is unavailable or the API key isn't configured.

const FAQ = [
  { keys: ['inflation', 'what is inflation'], a: "Inflation shows how much more expensive things are now compared to a year ago. If inflation is 20%, something that cost MK1,000 last year now costs about MK1,200." },
  { keys: ['food inflation', 'food price'], a: "Food inflation tracks the price of things like maize, rice, and vegetables compared to a year ago. It's shown separately from non-food because food prices often move differently — for example due to harvests." },
  { keys: ['non-food', 'nonfood', 'fuel', 'transport', 'rent'], a: "Non-food inflation covers things that aren't food — fuel, rent, transport, clothing. It's tracked separately from food because these prices are driven by different factors." },
  { keys: ['policy rate', 'interest rate'], a: "The Policy Rate is the interest rate the Reserve Bank of Malawi sets. When it rises, loans and borrowing usually get more expensive. When it falls, borrowing usually gets cheaper." },
  { keys: ['urban', 'rural', 'city', 'village'], a: "Prices don't move the same way everywhere — transport costs, food availability, and local markets differ between cities and villages, so this site shows inflation separately for urban and rural areas." },
  { keys: ['why', 'rising', 'going up', 'increase'], a: "Prices can rise for several reasons — higher fuel costs, poor harvests, currency movements, or global price changes. The 'What this means' box on the dashboard explains the current month's main driver." },
  { keys: ['growth', 'gdp', 'economy'], a: "The Growth Outlook shows how much bigger Malawi's economy is expected to get this year, based on the Reserve Bank's own projections." },
  { keys: ['source', 'where does this come from', 'real', 'accurate'], a: "Every figure on this site comes from a real Reserve Bank of Malawi or National Statistical Office release — see the Sources page for exact citations." },
  { keys: ['who', 'built', 'made this', 'official'], a: "This is an independent project, not affiliated with or endorsed by RBM. See the About page for details on who built it and why." },
  { keys: ['calculator', 'worth', 'value of money'], a: "The Inflation Impact Calculator on the dashboard shows how much your money's buying power changes over time at the current inflation rate — just type in an amount and number of years." },
];

const FALLBACK = "I'm not sure about that one yet — try asking about inflation, food prices, the policy rate, or how urban and rural areas differ. You can also check the Learn page for more explanations.";

function findAnswer(question) {
  const q = question.toLowerCase();
  for (const item of FAQ) {
    if (item.keys.some(k => q.includes(k))) return item.a;
  }
  return FALLBACK;
}

function initFaqBot() {
  const toggle = document.getElementById('faqToggle');
  const panel = document.getElementById('faqPanel');
  const messages = document.getElementById('faqMessages');
  const input = document.getElementById('faqInput');
  const sendBtn = document.getElementById('faqSend');

  toggle.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex';
  });

  function addMessage(text, who) {
    const div = document.createElement('div');
    div.className = 'faq-msg ' + who;
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  async function handleSend() {
    const q = input.value.trim();
    if (!q) return;
    addMessage(q, 'user');
    input.value = '';

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'faq-msg bot';
    loadingDiv.textContent = 'Thinking…';
    messages.appendChild(loadingDiv);
    messages.scrollTop = messages.scrollHeight;

    try {
      const res = await fetch('/api/faq-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q })
      });
      const data = await res.json();
      loadingDiv.remove();
      if (data.ok && data.answer) {
        addMessage(data.answer, 'bot');
      } else {
        addMessage(findAnswer(q), 'bot'); // fallback to rule-based
      }
    } catch (e) {
      loadingDiv.remove();
      addMessage(findAnswer(q), 'bot'); // fallback to rule-based
    }
  }

  sendBtn.addEventListener('click', handleSend);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') handleSend(); });

  addMessage("Hi! Ask me about inflation, food prices, the policy rate, or anything else on this dashboard.", 'bot');
}

document.addEventListener('DOMContentLoaded', initFaqBot);
