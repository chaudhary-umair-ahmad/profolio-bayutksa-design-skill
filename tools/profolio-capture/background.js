/**
 * Runs the capture and saves what comes back.
 *
 * The page script returns an object; this turns it into two downloads. It never
 * inspects or adds to the payload — everything that could be sensitive is
 * filtered inside capture.js, in the page, before it gets here.
 */
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type !== 'capture') return;

  (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return reply({ error: 'No active tab.' });
      if (/^(chrome|edge|about|chrome-extension):/.test(tab.url || ''))
        return reply({ error: 'Chrome will not let an extension read this page. Open the Profolio screen first.' });

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['capture.js'],
      });
      if (!result?.capture) return reply({ error: 'The page returned nothing. Reload it and try again.' });

      const dir = 'profolio-capture';
      const files = [];

      /* 1 — the measurements */
      const json = JSON.stringify(result, null, 2);
      await chrome.downloads.download({
        url: 'data:application/json;charset=utf-8,' + encodeURIComponent(json),
        filename: `${dir}/${msg.route}.capture.json`,
        saveAs: false,
      });
      files.push(`${msg.route}.capture.json`);

      /* 2 — the picture. Viewport only: Chrome gives an extension no full-page
             capture without the debugger API, which is a much larger permission
             to ask for. Scroll and click again if you need more of the page. */
      try {
        const png = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
        await chrome.downloads.download({
          url: png, filename: `${dir}/${msg.route}.png`, saveAs: false,
        });
        files.push(`${msg.route}.png`);
      } catch {
        files.push('(screenshot unavailable — the JSON is what the tooling reads)');
      }

      reply({
        nodes: result.nodes,
        truncated: result.truncated,
        viewport: `${result.viewport.w}x${result.viewport.h} @${result.viewport.dpr}x`,
        synthesised: (result.fonts?.synthesised || []).join(', '),
        files,
      });
    } catch (e) {
      reply({ error: String(e.message || e) });
    }
  })();

  return true;   /* keep the channel open for the async reply */
});
