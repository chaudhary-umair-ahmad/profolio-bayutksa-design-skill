/**
 * The states of /listings, as steps the harness performs on the real product.
 *
 * Every overlay in deliverables/listings.html has to have one of these behind
 * it. That is the whole discipline: an overlay is just another captured state,
 * measured before it is drawn, exactly like the default screen.
 *
 * Selectors are positional because the product gives them nothing else — the
 * row action buttons carry no aria-label, no title and no text, just
 * `button.ant-btn.ant-btn-circle`. Each index below was verified by clicking it
 * and recording what opened, not read off the source; the comment says what
 * came back.
 *
 *   Upgrades column: 6 buttons   Actions column: 5 buttons
 */

/** the Nth button of the Nth-from-last cell of the first row */
const rowBtn = (fromEnd, i) => async (p) => {
  const tds = p.locator('.ant-table-row').first().locator('td');
  const n = await tds.count();
  await tds.nth(n - fromEnd).locator('button').nth(i).click({ timeout: 8000 });
};

export default [
  {
    name: 'modal-trucheck',
    note: 'Actions[0] — 620×376 “TruCheck Eligible”',
    do: async (p) => { await rowBtn(1, 0)(p); await p.waitForSelector('.ant-modal', { timeout: 8000 }); },
  },
  {
    name: 'modal-delete',
    note: 'Actions[4] — 620×226 “Delete Listing / Why are you deleting your listing?”',
    do: async (p) => { await rowBtn(1, 4)(p); await p.waitForSelector('.ant-modal', { timeout: 8000 }); },
  },
  {
    name: 'drawer-filters',
    note: 'Show More — 450×900 “Filters / Apply filters to organize data accordingly”',
    do: async (p) => {
      await p.getByRole('button', { name: /Show More/i }).click();
      await p.waitForSelector('.ant-drawer-content', { timeout: 8000 });
    },
  },
  {
    name: 'modal-download-app',
    note: 'header Download App — 360×409 “Get the Bayut KSA App”',
    do: async (p) => {
      await p.getByRole('button', { name: /Download App/i }).click();
      await p.waitForSelector('.ant-modal', { timeout: 8000 });
    },
  },
  {
    name: 'popover-notifications',
    note: 'header bell — 590×330 popover, NOT a drawer. Empty state: “No notifications found”',
    do: async (p) => {
      await p.locator('.ant-layout-header button.ant-btn-default').first().click();
      await p.waitForSelector('.ant-popover', { timeout: 8000 });
    },
  },
  {
    name: 'popover-account',
    note: 'header avatar — 400×233 popover: name, role, email, verified badges, Account Settings, Sign Out',
    do: async (p) => {
      await p.locator('.ant-layout-header button.ant-btn-round').first().click();
      await p.waitForSelector('.ant-popover', { timeout: 8000 });
    },
  },
  /* Every status tab. The tab is a query param, not client-side state
     (listings.js:99 `f[nested.platform_listings.status.slug]`), so each one
     is a fresh request and each gets its own column set from
     listingUtilities.js:402 — Draft swaps Performance for Publish, Pending
     drops both, Removed carries both. Names match the page's #state= ids. */
  {
    name: 'tab-draft',
    note: 'Draft (2) — columns Property · Timeline · Status · Publish · Actions',
    do: async (p) => { await p.getByRole('tab', { name: /^Draft/ }).click(); await p.waitForTimeout(1500); },
  },
  {
    name: 'tab-pending',
    note: 'Pending (1) — columns Property · Timeline · Status · Actions',
    do: async (p) => { await p.getByRole('tab', { name: /^Pending/ }).click(); await p.waitForTimeout(1500); },
  },
  {
    name: 'tab-removed',
    note: 'Removed (0) — the EMPTY state, rendered by the product from an empty answer',
    do: async (p) => { await p.getByRole('tab', { name: /^Removed/ }).click(); await p.waitForTimeout(1500); },
  },
  {
    name: 'tab-ad-license-requests',
    note: 'Ad License Requests (0) — a different table entirely (adLicenseTableColumnMapper)',
    do: async (p) => { await p.getByRole('tab', { name: /^Ad License/ }).click(); await p.waitForTimeout(1500); },
  },
];
