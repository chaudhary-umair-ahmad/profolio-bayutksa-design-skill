/* The popup does no work of its own: it reads the route, asks the service
   worker to run the capture, and reports what came back. */
const $ = (id) => document.getElementById(id);
const out = $('out');

const slug = (p) => (p || '').replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'root';

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  try { $('route').value = new URL(tab.url).pathname; }
  catch { $('route').value = ''; }
});

$('go').addEventListener('click', () => {
  $('go').disabled = true;
  out.className = '';
  out.textContent = 'Capturing…';

  chrome.runtime.sendMessage({ type: 'capture', route: slug($('route').value) }, (res) => {
    $('go').disabled = false;
    if (chrome.runtime.lastError || !res) {
      out.className = 'err';
      out.textContent = chrome.runtime.lastError?.message || 'No response from the page.';
      return;
    }
    if (res.error) { out.className = 'err'; out.textContent = res.error; return; }
    out.className = 'ok';
    out.textContent =
      `${res.nodes} elements, ${res.viewport}\n` +
      `${res.files.join('\n')}` +
      (res.truncated ? '\n\nTree was capped — the page is very deep.' : '') +
      (res.synthesised ? `\n\nSynthesised weights: ${res.synthesised}` : '');
  });
});
