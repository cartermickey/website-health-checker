const siteSelect = document.getElementById('site-select');
const runBtn = document.getElementById('run-btn');
const statusBar = document.getElementById('status-bar');
const results = document.getElementById('results');
const summary = document.getElementById('summary');
const findingsList = document.getElementById('findings-list');

// Load site list
fetch('/api/sites')
  .then((r) => r.json())
  .then((sites) => {
    sites.forEach((site) => {
      const opt = document.createElement('option');
      opt.value = site.url;
      opt.textContent = site.name;
      siteSelect.appendChild(opt);
    });
  });

siteSelect.addEventListener('change', () => {
  runBtn.disabled = !siteSelect.value;
});

runBtn.addEventListener('click', startAudit);

function startAudit() {
  const url = siteSelect.value;
  if (!url) return;

  runBtn.disabled = true;
  results.classList.add('hidden');
  findingsList.innerHTML = '';
  summary.innerHTML = '';
  setStatus('Starting audit...');

  fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
    .then((r) => r.json())
    .then(({ auditId }) => streamAudit(auditId))
    .catch((err) => setStatus('Error: ' + err.message));
}

function streamAudit(auditId) {
  const es = new EventSource(`/api/audit/${auditId}/stream`);
  const pageGroups = {};

  es.onmessage = (e) => {
    const event = JSON.parse(e.data);

    if (event.type === 'progress') {
      setStatus(`[${event.page}] ${event.message}`);
    }

    if (event.type === 'finding') {
      results.classList.remove('hidden');
      if (!pageGroups[event.page]) {
        pageGroups[event.page] = document.createElement('div');
        pageGroups[event.page].className = 'page-group';
        pageGroups[event.page].innerHTML = `<h2>${event.page}</h2>`;
        findingsList.appendChild(pageGroups[event.page]);
      }
      const item = document.createElement('div');
      item.className = `finding-item ${event.pass ? 'pass' : 'fail'}`;
      item.innerHTML = `
        <span class="icon">${event.pass ? '✅' : '❌'}</span>
        <span class="check-name">${event.check}</span>
        ${!event.pass && event.reason ? `<span class="reason">${event.reason}</span>` : ''}
      `;
      pageGroups[event.page].appendChild(item);
    }

    if (event.type === 'done') {
      es.close();
      runBtn.disabled = false;
      const { passed, failed } = event.summary;
      summary.innerHTML = `
        <div class="summary-box">
          <span class="summary-pass">✅ ${passed} passed</span>
          <span class="summary-fail">❌ ${failed} failed</span>
        </div>
      `;
      setStatus('Audit complete.');
    }

    if (event.type === 'error') {
      es.close();
      runBtn.disabled = false;
      setStatus('Audit error: ' + event.message);
    }
  };

  es.onerror = () => {
    es.close();
    runBtn.disabled = false;
    setStatus('Connection lost. Audit may still be running.');
  };
}

function setStatus(msg) {
  statusBar.textContent = msg;
  statusBar.classList.remove('hidden');
}
