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
  })
  .catch(() => setStatus('Failed to load site list. Please refresh.'));

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
    .then((r) => {
      if (!r.ok) throw new Error(`Server error ${r.status}`);
      return r.json();
    })
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
        const heading = document.createElement('h2');
        heading.textContent = event.page;
        pageGroups[event.page].appendChild(heading);
        findingsList.appendChild(pageGroups[event.page]);
      }
      const item = document.createElement('div');
      item.className = `finding-item ${event.pass ? 'pass' : 'fail'}`;

      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = event.pass ? '✅' : '❌';

      const checkName = document.createElement('span');
      checkName.className = 'check-name';
      checkName.textContent = event.check;

      item.appendChild(icon);
      item.appendChild(checkName);

      if (!event.pass && event.reason) {
        const reason = document.createElement('span');
        reason.className = 'reason';
        reason.textContent = event.reason;
        item.appendChild(reason);
      }

      pageGroups[event.page].appendChild(item);
    }

    if (event.type === 'done') {
      es.close();
      runBtn.disabled = false;
      results.classList.remove('hidden');
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
