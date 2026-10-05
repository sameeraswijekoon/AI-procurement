const tenderFileInput = document.querySelector('#tender-file');
const productFileInput = document.querySelector('#product-file');
const tender = document.querySelector('#tender');
const analyzeButton = document.querySelector('#analyze-button');
const resultPanel = document.querySelector('#result-panel');
const resultBody = document.querySelector('#result-body');
const toast = document.querySelector('#toast');
const progressPanel = document.querySelector('#progress-panel');
let productMode = 'pdf';
let toastTimer;
let progressTimer;
let progressStartedAt = 0;
let configuredProviders = { gemini: false, openrouter: false };
const isGitHubPages = location.origin === 'https://sameeraswijekoon.github.io' && location.pathname.startsWith('/AI-procurement');
const apiBaseUrl = isGitHubPages ? 'http://127.0.0.1:4173' : '';

if (isGitHubPages) {
  document.querySelector('.local-pill').innerHTML = '<i></i> Personal local AI server';
  document.querySelector('#provider-health').textContent = 'Connecting to local server…';
}

document.querySelectorAll('input[name="provider-mode"]').forEach(input => input.addEventListener('change', syncRunSettings));
document.querySelectorAll('input[name="reasoning-level"]').forEach(input => input.addEventListener('change', () => {
  document.querySelectorAll('.preset-option').forEach(option => option.classList.toggle('selected', option.querySelector('input').checked));
}));
syncRunSettings();
fetch(`${apiBaseUrl}/api/config`).then(response => {
  if (!response.ok) throw new Error('Local API server is unavailable.');
  return response.json();
}).then(config => {
  configuredProviders = config.providers || configuredProviders;
  const label = configuredProviders.gemini && configuredProviders.openrouter ? 'Gemini ready · OpenRouter backup ready' : configuredProviders.gemini ? 'Gemini ready · No backup configured' : configuredProviders.openrouter ? 'OpenRouter ready · Backup only' : 'No AI provider configured';
  document.querySelector('#provider-health').innerHTML = `<span class="health-dot"></span>${label}`;
  syncRunSettings();
}).catch(() => {
  document.querySelector('#provider-health').textContent = isGitHubPages ? 'Start local server · npm start' : 'Provider status unavailable';
});

function syncRunSettings() {
  const mode = document.querySelector('input[name="provider-mode"]:checked')?.value || 'auto';
  document.querySelectorAll('.provider-option').forEach(option => {
    option.classList.toggle('selected', option.querySelector('input').checked);
  });
  document.querySelector('#gemini-model-field').hidden = mode === 'openrouter';
  document.querySelector('#openrouter-model-field').hidden = mode !== 'openrouter';
  const note = document.querySelector('#reasoning-note');
  if (mode === 'openrouter') note.textContent = 'The preset guides GPT-4o on comparison depth. Gemini thinking controls apply only when Gemini is selected.';
  else if (mode === 'auto') note.textContent = 'Reasoning level controls Gemini thinking depth. If Gemini is unavailable, OpenRouter GPT-4o uses the same review-depth instructions.';
  else note.textContent = 'Reasoning level maps to Gemini’s low, medium, and high thinking settings.';
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3600);
}

function bindFileName(input, output) {
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    output.textContent = file ? file.name : 'Browse';
    output.classList.toggle('selected', !!file);
    if (file && (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf'))) {
      input.value = '';
      output.textContent = 'Browse';
      output.classList.remove('selected');
      notify('Please choose a PDF file.');
    } else if (file && file.size > 18 * 1024 * 1024) {
      input.value = '';
      output.textContent = 'Browse';
      output.classList.remove('selected');
      notify('PDFs must be 18 MB or smaller.');
    }
  });
}

bindFileName(tenderFileInput, document.querySelector('#tender-name'));
bindFileName(productFileInput, document.querySelector('#product-name'));

document.querySelector('#tab-pdf').addEventListener('click', () => setProductMode('pdf'));
document.querySelector('#tab-link').addEventListener('click', () => setProductMode('link'));
function setProductMode(mode) {
  productMode = mode;
  document.querySelector('#tab-pdf').classList.toggle('active', mode === 'pdf');
  document.querySelector('#tab-link').classList.toggle('active', mode === 'link');
  document.querySelector('#tab-pdf').setAttribute('aria-selected', String(mode === 'pdf'));
  document.querySelector('#tab-link').setAttribute('aria-selected', String(mode === 'link'));
  document.querySelector('#product-pdf-pane').hidden = mode !== 'pdf';
  document.querySelector('#product-link-pane').hidden = mode !== 'link';
}

tender.addEventListener('input', () => {
  document.querySelector('#char-count').textContent = `${tender.value.length.toLocaleString()} / 12,000`;
});

function fileAsDataUrl(file, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => resolve(reader.result);
    reader.onprogress = event => { if (event.lengthComputable) onProgress(event.loaded, event.total); };
    reader.readAsDataURL(file);
  });
}

function updateProgress(percent, status, detail, complete = false) {
  const rounded = Math.max(0, Math.min(100, Math.round(percent)));
  document.querySelector('#progress-status').textContent = status;
  document.querySelector('#progress-number').textContent = complete ? '100%' : `~${rounded}%`;
  document.querySelector('#progress-detail').textContent = detail;
  document.querySelector('#elapsed-time').textContent = formatElapsed(Date.now() - progressStartedAt);
  document.querySelector('#progress-fill').style.width = `${complete ? 100 : rounded}%`;
  document.querySelector('#analysis-progress').setAttribute('aria-valuenow', String(complete ? 100 : rounded));
}

function formatElapsed(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function showProgressError(message) {
  clearInterval(progressTimer);
  progressPanel.classList.add('error');
  document.querySelector('#progress-number').textContent = 'Error';
  document.querySelector('#progress-status').textContent = 'The comparison could not finish';
  document.querySelector('#progress-detail').textContent = message;
  document.querySelector('#progress-fill').style.width = '100%';
  document.querySelector('#analysis-progress').setAttribute('aria-valuenow', '0');
}

function startWaitingProgress(hasUrl) {
  clearInterval(progressTimer);
  const waitingStartedAt = Date.now();
  const selectedMode = document.querySelector('input[name="provider-mode"]:checked')?.value || 'auto';
  const providerStatus = selectedMode === 'openrouter' ? 'Using OpenRouter only · GPT-4o selected.' : selectedMode === 'gemini' ? 'Using Gemini only · selected model and reasoning level.' : 'Auto mode: Gemini first, OpenRouter backup.';
  progressTimer = setInterval(() => {
    const seconds = (Date.now() - waitingStartedAt) / 1000;
    const estimated = Math.min(92, 44 + 48 * (1 - Math.exp(-seconds / 42)));
    let status = 'AI is comparing the specifications…';
    let detail = `Still working. ${providerStatus}`;
    if (hasUrl && seconds < 12) {
      status = 'Retrieving the product webpage…';
      detail = 'Checking the public product page and collecting its specifications.';
    } else if (seconds < 20) {
      status = 'Reading the tender and product evidence…';
      detail = 'Preparing the requirements for comparison.';
    }
    updateProgress(estimated, status, detail);
  }, 700);
}

function sendAnalysisRequest(body, hasUrl) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${apiBaseUrl}/api/analyze`);
    request.setRequestHeader('Content-Type', 'application/json');
    request.timeout = 180000;
    request.upload.addEventListener('progress', event => {
      if (event.lengthComputable) {
        const percent = 14 + 30 * (event.loaded / event.total);
        updateProgress(percent, 'Sending documents securely…', 'Uploading the selected tender and product evidence.');
      }
    });
    request.upload.addEventListener('load', () => {
      updateProgress(44, hasUrl ? 'Checking the product webpage…' : 'Preparing the comparison…', hasUrl ? 'The request reached the local assistant; checking the page now.' : 'The PDFs are ready for analysis.');
      startWaitingProgress(hasUrl);
    });
    request.addEventListener('load', () => {
      clearInterval(progressTimer);
      let payload;
      try { payload = JSON.parse(request.responseText); }
      catch { return reject(new Error('The local assistant returned an unreadable response. Try again.')); }
      if (request.status < 200 || request.status >= 300) return reject(new Error(payload.error || 'Analysis failed.'));
      updateProgress(100, 'Comparison complete', 'Your specification table is ready.', true);
      progressPanel.classList.add('complete');
      resolve(payload);
    });
    request.addEventListener('error', () => reject(new Error('Could not connect to the local assistant. Check that it is still running.')));
    request.addEventListener('timeout', () => reject(new Error('This is taking longer than expected. Try again in a moment.')));
    request.send(JSON.stringify(body));
  });
}

analyzeButton.addEventListener('click', async () => {
  const tenderFile = tenderFileInput.files?.[0];
  const productFile = productFileInput.files?.[0];
  const productUrl = document.querySelector('#product-url').value.trim();
  if (!tenderFile && tender.value.trim().length < 5) return notify('Upload the tender PDF or paste the requirements.');
  if (productMode === 'pdf' && !productFile) return notify('Choose a product PDF first.');
  if (productMode === 'link' && !productUrl) return notify('Enter the public product page link.');
  if (productMode === 'link' && !/^https?:\/\//i.test(productUrl)) return notify('Enter the full product URL starting with https://');

  analyzeButton.disabled = true;
  analyzeButton.querySelector('span:first-child').textContent = 'Working…';
  progressPanel.hidden = false;
  progressPanel.classList.remove('error', 'complete');
  progressStartedAt = Date.now();
  updateProgress(3, 'Preparing your documents…', 'Reading selected PDFs before sending them.');
  const files = [tenderFile, productMode === 'pdf' ? productFile : null].filter(Boolean);
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const fileProgress = new Map(files.map(file => [file, 0]));
  const updateFileProgress = (file, loaded, description) => {
    fileProgress.set(file, loaded);
    const bytesRead = [...fileProgress.values()].reduce((sum, value) => sum + value, 0);
    updateProgress(3 + 10 * bytesRead / Math.max(totalBytes, 1), 'Preparing your documents…', description);
  };
  try {
    const [tenderPdf, productPdf] = await Promise.all([
      tenderFile ? fileAsDataUrl(tenderFile, loaded => updateFileProgress(tenderFile, loaded, 'Reading the tender PDF.')) : null,
      productMode === 'pdf' ? fileAsDataUrl(productFile, loaded => updateFileProgress(productFile, loaded, 'Reading the product PDF.')) : null
    ]);
    updateProgress(14, 'Documents ready', 'Sending the comparison request.');
    const payload = await sendAnalysisRequest({
      tender: tender.value,
      tenderPdf,
      productPdf,
      productUrl: productMode === 'link' ? productUrl : '',
      providerMode: document.querySelector('input[name="provider-mode"]:checked')?.value || 'auto',
      geminiModel: document.querySelector('#gemini-model').value,
      openRouterModel: document.querySelector('#openrouter-model').value,
      reasoningLevel: document.querySelector('input[name="reasoning-level"]:checked')?.value || 'medium',
      reportScope: document.querySelector('#report-scope').value,
      includeEvidence: document.querySelector('#include-evidence').checked
    }, productMode === 'link');
    renderResult(payload.result);
    const providerBadge = document.querySelector('#provider-badge');
    providerBadge.textContent = `${payload.provider || 'AI'}${payload.model ? ` · ${payload.model}` : ''}`;
    providerBadge.classList.toggle('backup-provider', payload.provider === 'OpenRouter');
    resultPanel.hidden = false;
    resultPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    showProgressError(error.message || 'Analysis failed.');
    notify(error.message || 'Could not connect to the local assistant.');
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.querySelector('span:first-child').textContent = 'Compare against tender';
  }
});

function renderResult(text) {
  resultBody.replaceChildren();
  const lines = text.split('\n').map(line => line.trim()).filter(line => line && !/^```/.test(line));
  const tableRows = lines.filter(line => line.startsWith('|'));
  if (!tableRows.length) {
    const fallback = document.createElement('p');
    fallback.textContent = text;
    resultBody.append(fallback);
    return;
  }

  const firstTableLine = lines.findIndex(line => line.startsWith('|'));
  const summary = lines.slice(0, firstTableLine).join(' ');
  if (summary) {
    const summaryNode = document.createElement('p');
    summaryNode.className = 'result-summary';
    summaryNode.textContent = summary;
    resultBody.append(summaryNode);
  }

  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const table = document.createElement('table');
  const rows = tableRows.map(line => line.split('|').slice(1, -1).map(cell => cell.trim().replace(/^\*\*(.*)\*\*$/, '$1')));
  const headers = rows.shift();
  if (headers) {
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(label => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; headerRow.append(th); });
    thead.append(headerRow);
    table.append(thead);
  }
  const tbody = document.createElement('tbody');
  for (const cells of rows) {
    if (cells.every(cell => /^:?-{3,}:?$/.test(cell))) continue;
    const row = document.createElement('tr');
    cells.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? 'th' : 'td');
      if (index === 0) cell.scope = 'row';
      cell.textContent = value.replace(/\*\*/g, '');
      if (index === 0) {
        const status = value.toLowerCase().replace(/[^a-z-]/g, '');
        if (status.includes('non-compliant')) cell.className = 'status-non-compliant';
        else if (status.includes('clarification')) cell.className = 'status-clarification';
        else if (status.includes('compliant')) cell.className = 'status-compliant';
      }
      row.append(cell);
    });
    tbody.append(row);
  }
  table.append(tbody);
  wrap.append(table);
  resultBody.append(wrap);

  const clarification = lines.slice(firstTableLine + tableRows.length).join(' ');
  if (clarification) {
    const note = document.createElement('p');
    note.className = 'clarification-note';
    note.textContent = clarification;
    resultBody.append(note);
  }
}

document.querySelector('#speak-button').addEventListener('click', () => {
  if (!('speechSynthesis' in window)) return notify('Speech output is not supported in this browser.');
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(resultBody.innerText);
  utterance.rate = 1.02;
  speechSynthesis.speak(utterance);
});
