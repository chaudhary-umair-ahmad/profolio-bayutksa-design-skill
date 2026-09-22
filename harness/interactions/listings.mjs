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

/** the Nth upgrade circle of the first row (the second-from-last cell) */
const upgradeBtn = (i) => async (p) => {
  const tds = p.locator('.ant-table-row').first().locator('td');
  const n = await tds.count();
  await tds.nth(n - 2).locator('button').nth(i).click({ timeout: 8000 });
};

/** the Nth button of the Nth-from-last cell of the first row */
const rowBtn = (fromEnd, i) => async (p) => {
  const tds = p.locator('.ant-table-row').first().locator('td');
  const n = await tds.count();
  await tds.nth(n - fromEnd).locator('button').nth(i).click({ timeout: 8000 });
};

/* ── hover states ──────────────────────────────────────────────────────────
   Six of this screen's popovers open on HOVER, not click, and a seventh opens
   on click inside a table cell. None of them had ever been captured, so every
   value the design system had for a table-body popover was invented.

   The selectors below are not guesses. A probe hovered all 23 hoverable things
   in row 0 and reported what appeared; these are the ones that opened
   something, with the size it opened at. Anything the probe could not make
   open is absent here with a note saying why — that is a fixture gap, not a
   selector problem.

   Hover needs the mouse parked somewhere harmless first: antd keeps the last
   popover open while the pointer is anywhere inside it, so two steps in a row
   can otherwise capture the first one twice. */
const away = async (p) => {
  await p.keyboard.press('Escape').catch(() => {});
  await p.mouse.move(4, 4);
  /* antd leaves the last tooltip mounted and merely hidden, and a
     waitForSelector on .ant-tooltip-inner will happily match the leftover. Wait
     for the page to have no VISIBLE tooltip or popover before hovering the
     next thing, or two steps in a row capture the first one twice. */
  await p.waitForFunction(() => ![...document.querySelectorAll('.ant-tooltip, .ant-popover')]
    .some((el) => !el.classList.contains('ant-tooltip-hidden')
                && !el.classList.contains('ant-popover-hidden')
                && el.getBoundingClientRect().width > 0), null, { timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(250);
};

/** hover something in the Nth cell of row 0 and wait for its popover */
const hoverInCell = (td, sel, wait = '.ant-popover-inner') => async (p) => {
  await away(p);
  const el = p.locator('.ant-table-row').first().locator('td').nth(td).locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await el.hover({ force: true });
  await p.waitForSelector(wait, { timeout: 8000 });
  await p.waitForTimeout(400);
};

/** the same, on any row — harness/fixtures.mjs gives each row a different job */
const hoverIn = (row, td, sel, { wait = '.ant-popover-inner', i = 0 } = {}) => async (p) => {
  await away(p);
  const all = p.locator('.ant-table-row').nth(row).locator('td').nth(td).locator(sel);
  const target = i === 'last' ? all.last() : all.nth(i);
  await target.scrollIntoViewIfNeeded();
  await target.hover({ force: true });
  await p.waitForSelector(wait, { timeout: 8000 });
  await p.waitForTimeout(400);
};

const clickIn = (row, td, sel, { wait = '.ant-popover-inner', i = 0 } = {}) => async (p) => {
  await away(p);
  const all = p.locator('.ant-table-row').nth(row).locator('td').nth(td).locator(sel);
  const target = i === 'last' ? all.last() : all.nth(i);
  await target.scrollIntoViewIfNeeded();
  await target.click({ force: true, timeout: 8000 });
  await p.waitForSelector(wait, { timeout: 8000 });
  await p.waitForTimeout(400);
};

export default [
  {
    name: 'modal-trucheck',
    note: 'Actions[0] — 620×376 “TruCheck Eligible”',
    do: async (p) => { await rowBtn(1, 0)(p); await p.waitForSelector('.ant-modal', { timeout: 8000 }); },
  },
  {
    name: 'modal-delete',
    /* NOT a fixed index. Delete is always last (listingUtilities.js:9) but how
       many buttons precede it depends on the row: Apply Discount only renders
       when the listing is discountable and Mark as Booked only on a daily
       rental, so the same index means different things on different rows. This
       step used to say Actions[4] and quietly started opening Apply Discount
       the day the fixtures learned to offer a discount. */
    note: 'the LAST row action — 620×226 “Delete Listing / Why are you deleting your listing?”',
    do: async (p) => {
      const tds = p.locator('.ant-table-row').first().locator('td');
      const btns = tds.nth((await tds.count()) - 1).locator('button');
      await btns.nth((await btns.count()) - 1).click({ timeout: 8000 });
      await p.waitForSelector('.ant-modal', { timeout: 8000 });
    },
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
  /* ── the flows the old fixture account hid ────────────────────────────
     Every upgrade circle and the sixth row action were disabled or absent
     until harness/fixtures.mjs learned to say `is_applicable` and
     `discount_applicable`. Now they can be clicked, so they can be captured.
     A step that opens nothing is reported as a failure and costs one line —
     which is the cheapest way to find out what each control actually does. */
  {
    name: 'upgrade-signature',
    note: 'Upgrades[0] — Signature',
    do: async (p) => { await upgradeBtn(0)(p); await p.waitForTimeout(1200); },
  },
  {
    name: 'upgrade-hot',
    note: 'Upgrades[1] — Hot (applied on some rows, so click row 0)',
    do: async (p) => { await upgradeBtn(1)(p); await p.waitForTimeout(1200); },
  },
  {
    name: 'upgrade-refresh',
    note: 'Upgrades[2] — Refresh',
    do: async (p) => { await upgradeBtn(2)(p); await p.waitForTimeout(1200); },
  },
  {
    name: 'upgrade-photography',
    note: 'Upgrades[3] — Photography service',
    do: async (p) => { await upgradeBtn(3)(p); await p.waitForTimeout(1200); },
  },
  {
    name: 'action-detail-drawer',
    note: 'Actions[2] — IoMdEye is detail-drawer (table-actions.js:31), so this should open a drawer',
    do: async (p) => { await rowBtn(1, 2)(p); await p.waitForTimeout(1200); },
  },
  {
    name: 'action-discount',
    note: 'Actions[4] — "Apply Discount" (listingUtilities.js:222); it may navigate rather than open',
    do: async (p) => { await rowBtn(1, 4)(p); await p.waitForTimeout(1200); },
  },

  /* ── the popovers and tooltips in the table body ───────────────────────
     Measured by the probe before they were written down:
       health 440x352 · timeline 180x54 · leads 216x235
       upgrade tooltips 109-250 wide · action tooltips 66-137 wide
     Two more exist in the product and cannot open on this account yet:
       REGA "Expiring on" wants a row with regaExpiryDate
         (listing-purpose.js:346)
       status rejection reasons wants a rejected row carrying `comments`
         (platforms-status.js:16, listingUtilities.js:100) — the only
         CLICK-triggered popover in the table body
     Both are listed in authoring/listings-buttons.md as unmeasured until the
     fixtures carry those rows. */
  {
    name: 'popover-health',
    note: 'hover the quality chip — 440x352 "Overall Quality", with Refresh and two Add buttons inside',
    /* td0 carries three tags — the product tag, the score chip, the purpose
       tag — and only the middle one opens anything. It is the one whose text
       is a percentage; ant-tag-warning is the colour it happens to be at 62%,
       not what it is. */
    do: hoverInCell(0, '.ant-tag:has-text("%")'),
  },
  {
    name: 'popover-timeline',
    note: 'hover Timeline\u2019s AiOutlineInfoCircle — 180x54, the full posted-on date and time',
    do: hoverInCell(1, '.anticon'),
  },
  {
    name: 'popover-leads',
    note: 'hover the Leads AiOutlineInfoCircle — 216x235, the LMS breakdown. Views and Clicks have no icon at all',
    do: hoverInCell(2, '.anticon'),
  },
  {
    name: 'tooltip-upgrade',
    note: 'hover Upgrades[0] — 153x40 "Mark Signature". This is ActionPopOver in its default state (platformActions.js:124); applied and pending add an "Expiring on" line and need a fixture row in those states',
    do: hoverInCell(4, 'button', '.ant-tooltip-inner'),
  },
  {
    name: 'tooltip-upgrade-service',
    note: 'hover Upgrades[3] — 250x54 "Request Photography Service", the two-line tooltip the three add-on services share',
    do: async (p) => {
      await away(p);
      const b = p.locator('.ant-table-row').first().locator('td').nth(4).locator('button').nth(3);
      await b.scrollIntoViewIfNeeded();
      await b.hover({ force: true });
      await p.waitForSelector('.ant-tooltip-inner', { timeout: 8000 });
      await p.waitForTimeout(400);
    },
  },
  {
    name: 'tooltip-action',
    note: 'hover Actions[1] — 132x40 "View on Bayut". The seven labels measure 66-137 wide (table-actions.js:62-109)',
    do: async (p) => {
      await away(p);
      const b = p.locator('.ant-table-row').first().locator('td').nth(5).locator('button').nth(1);
      await b.scrollIntoViewIfNeeded();
      await b.hover({ force: true });
      await p.waitForSelector('.ant-tooltip-inner', { timeout: 8000 });
      await p.waitForTimeout(400);
    },
  },

  /* ── the open Select, which six dead controls were waiting on ──────────
     No capture in this system had ever contained an .ant-select-dropdown, so
     the filter bar's two selects, the four in the filters drawer and the
     booking modal's date field could only ever be drawn shut. The probe opened
     both: 245x137 with 3 flat options, and 245x278 with 8 options under 1
     group header — the grouped multi-select is a different panel, not the same
     one taller. */
  {
    name: 'select-purpose',
    note: 'filter bar Purpose — 245x137, 3 options, flat',
    do: async (p) => {
      await p.locator('.ant-select').first().click();
      await p.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 8000 });
      await p.waitForTimeout(500);
    },
  },
  {
    name: 'select-property-type',
    note: 'filter bar Property Type — 245x278, 8 options under 1 group header, multi-select',
    do: async (p) => {
      await p.locator('.ant-select').nth(1).click();
      await p.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 8000 });
      await p.waitForTimeout(500);
    },
  },
  {
    name: 'date-posted-on',
    note: 'filters drawer \u2192 Posted On — a DrawerPopover holding DateRangePickerOne (DateFilter.js:71-105). Click, not hover',
    do: async (p) => {
      await p.getByRole('button', { name: /Show More/i }).click();
      await p.waitForSelector('.ant-drawer-content', { timeout: 8000 });
      await p.waitForTimeout(600);
      /* NOT input[readonly] — that is City's search box, which is readonly
         until you type. Posted On is a plain text input carrying the
         placeholder, and clicking it is what opens the calendar. */
      await p.getByPlaceholder(/Select Date Range/i).first().click({ timeout: 8000 });
      await p.waitForSelector('.ant-picker-panel, .ant-popover-inner', { timeout: 8000 });
      await p.waitForTimeout(500);
    },
  },

  /* ── the states each fixture row exists to produce ─────────────────────
     harness/fixtures.mjs gives every row a job, and these are the captures
     that job was for. Each one was unmeasured until the row existed:
       row 1 rejected · row 2 rega expiry · row 3 applied + requested
       row 6 booked · row 7 pending-otp · row 8 services unavailable */
  {
    name: 'popover-rega',
    note: 'row 2, Property cell — hover the AiOutlineInfoCircle beside the REGA id (listing-purpose.js:346). It is the LAST icon in the cell; the four before it are the bed/bath/area specs, and a row without a rega expiry has only those four',
    do: hoverIn(2, 0, '.anticon', { i: 'last' }),
  },
  {
    name: 'popover-status-rejected',
    note: 'row 1, Status cell — CLICK the info icon beside a red Rejected pill (platforms-status.js:16). The only click-triggered popover in the table body',
    do: clickIn(1, 3, '.anticon'),
  },
  {
    name: 'tooltip-upgrade-applied',
    note: 'row 3, Upgrades[0] — Signature is applied, so the circle carries the green HiCheck, is disabled, and the panel reads "Signature Listing" rather than "Mark Signature"',
    do: hoverIn(3, 4, 'button', { wait: '.ant-tooltip-inner', i: 0 }),
  },
  {
    name: 'tooltip-upgrade-pending',
    note: 'row 3, Upgrades[3] — Photography is requested, so RequestedStateIcon overlays the circle in the warning colour and the panel adds "Selected Date & Time"',
    do: hoverIn(3, 4, 'button', { wait: '.ant-tooltip-inner', i: 3 }),
  },
  {
    name: 'tooltip-upgrade-none',
    note: 'row 8, Upgrades[2] — refresh is not applicable and is not an add-on service, so platformActions.js:115-136 gives it NO tooltip at all. A disabled circle is not always a circle with an explanation',
    do: async (p) => {
      await away(p);
      const b = p.locator('.ant-table-row').nth(8).locator('td').nth(4).locator('button').nth(2);
      await b.hover({ force: true });
      await p.waitForTimeout(900);
    },
  },
  {
    name: 'tooltip-upgrade-unavailable',
    note: 'row 8, Upgrades[3] — the one tooltip that is a plain string rather than a panel: "This service is not available in your region yet." (platformActions.js:115-136)',
    do: hoverIn(8, 4, 'button', { wait: '.ant-tooltip-inner', i: 3 }),
  },
  {
    name: 'tooltip-booked',
    note: 'row 6, Property cell — hover the Booked chip over the thumbnail for "Booked Until <date>" (listing-purpose.js:217)',
    do: hoverIn(6, 0, '.ant-tag', { wait: '.ant-tooltip-inner', i: 0 }),
  },
  {
    name: 'modal-booking',
    note: 'row 4, Actions — Mark as Booked, which renders only on a daily-rental listing (listingUtilities.js:238). Captured in context rather than from the design-capture route',
    do: async (p) => {
      const tds = p.locator('.ant-table-row').nth(4).locator('td');
      const n = await tds.count();
      const btns = tds.nth(n - 1).locator('button');
      await btns.nth((await btns.count()) - 2).click({ timeout: 8000 });
      await p.waitForSelector('.ant-modal', { timeout: 8000 });
      await p.waitForTimeout(500);
    },
  },
  {
    name: 'modal-otp',
    note: 'row 7, Upgrades — the listing is pending-otp-verification, so the cell holds Publish Now instead of six circles, and it opens OtpVerificationModal (platformActions.js:174-213)',
    do: async (p) => {
      const tds = p.locator('.ant-table-row').nth(7).locator('td');
      const n = await tds.count();
      await tds.nth(n - 2).locator('button').first().click({ timeout: 8000 });
      await p.waitForSelector('.ant-modal', { timeout: 10000 });
      await p.waitForTimeout(600);
    },
  },

  /* ── the other half of the screen ──────────────────────────────────────
     appRoutes.js:83 splits /listings in two, and this system had only ever
     seen one half. A member-area user has the promo banner and the
     CreditsQuota widgets above the table and NO FILTER BAR at all
     (ListingContainer.js:96). These two steps answer /users/current with
     is_package_user:false, which is the whole difference. */
  {
    name: 'member-area',
    /* KNOWN TO FAIL, and kept because a failed step that says why is worth
       more than a missing one. With is_package_user:false the app never
       paints .ant-layout at all: the member area mounts the CLASSIFIED
       site's header, which calls /api/user/favorites, /api/user/searches/saved
       and a bookings endpoint that is off-origin and therefore blocked here.
       Answering the first two is not enough. Reaching this variant is a
       fixture job of its own, not a selector problem. */
    note: 'the variant with the banner and the credits widgets and no filter bar (appRoutes.js:83) — does not mount under the harness; see the comment',
    mode: 'member',
  },
  {
    name: 'drawer-credit-info',
    note: 'member area → the BsInfoLg on the CreditsQuota card opens CreditInfoDrawer (credits-quota.js:134-145). Blocked by the same thing as member-area above',
    mode: 'member',
    do: async (p) => {
      await p.locator('.ant-card button').filter({ hasNot: p.locator('.ant-tabs') }).first().click({ timeout: 8000 });
      await p.waitForSelector('.ant-drawer-content', { timeout: 8000 });
      await p.waitForTimeout(500);
    },
  },

  /* the two states that are not a click: what the screen looks like while the
     listings query is in flight, and what it looks like when it fails. Both
     are the PRODUCT's own rendering — a skeleton it ships and an error card it
     ships — captured rather than imagined. */
  {
    name: 'loading',
    note: 'the listings query held open — antd Skeleton/Spin, whatever the product paints while waiting',
    mode: 'slow',
  },
  {
    name: 'error',
    note: '/api/surge/listings answers 500 — the product\'s own error card',
    mode: 'error',
  },
];
