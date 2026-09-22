/**
 * Answers for every API call the product makes, from invented KSA data.
 *
 * Shapes come from the transformers, not from a recording of live — see
 * harness/fixtures.md for the trace and the three traps (`stats.ksa` not
 * `stats.platforms.bayut`; `product_stats.items` is an object keyed by date;
 * `platform_mapping.bayut.mapped` must be true). Strings and lengths mirror
 * the real account's shapes so layout stays honest; none of it is a real
 * person, agency, listing or number.
 *
 *   import { answer } from './fixtures.mjs';
 *   const body = answer('GET', '/api/surge/listings', '?page=1');   // object | undefined
 */
import { readFileSync } from 'node:fs';

const HERE = new URL('.', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, HERE), 'utf8'));
const user = read('./fixtures/user.json');
const page = read('../data/fixtures/dashboard.json');   /* the same invented data the HTML composes from */

const U = user.user;
/* profileDataMapper reads profile_image.sizes.thumbnail unguarded, so the
   shape has to exist — but the STRING is empty, so antd's Avatar falls back to
   its icon. That is what the design system documents (user.json:107), and
   serving a picture made the header compare a photo against a glyph: 8.3% on
   a shell region with a 6% threshold, none of it a real disagreement. */
const AVATAR = { sizes: { thumbnail: '', small: '' } };
const AGENCY = U.agency;

/* ── dates: the report window is the last 30 days from now ─────────────── */
const day = (offset) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - offset); return d; };
const iso = (d) => d.toISOString().slice(0, 10);

/* ── listings ──────────────────────────────────────────────────────────── */
const STATUSES = [
  { id: 1, slug: 'active',  name: 'Active' },
  { id: 2, slug: 'draft',   name: 'Draft' },
  { id: 3, slug: 'pending', name: 'Pending' },
  { id: 4, slug: 'removed', name: 'Removed' },
];
/* shaped like the real account rather than a tidy one — the real screen reads
   Active (51) · Draft (1) · Pending (4) · Removed (172) · Ad License (5), and
   three-digit counts are what the tabs have to hold */
const SUMMARY = { active: page.listings.active, draft: 1, pending: 4, removed: 172 };

/* "64 Sq. M." has dots after the number; strip separators, then take the leading number */
const num = (s) => parseFloat(String(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/)?.[0] ?? 'NaN');
const purposeOf = (title) => /Rent/i.test(title)
  ? { id: 2, slug: 'for-rent', name: 'Rent', name_l1: 'للإيجار' }
  : { id: 1, slug: 'for-sale', name: 'Sale', name_l1: 'للبيع' };

/* one API listing per invented row; the row carries the display strings, this
   carries what the transformer needs to produce them */
const listings = page.recentListings.map((r, i) => {
  const [type] = r.title.split(' for ');
  const [city, district, area] = r.location.split(', ');
  const purpose = purposeOf(r.title);
  const posted = day(2 + i * 3);
  /* products_information is an ARRAY over the wire.
     transformers/listings.js:113 reduces it to an object keyed by slug, which
     is the shape products.js:5 and :85 then read. I changed this to an object
     first, on the strength of those readers, and the table stopped rendering
     entirely — 225 nodes instead of 1571, because line 97 calls `.find()` on
     it before the reduce ever runs. The array is right.

     What was actually missing is `is_applicable` — whether this account can
     buy the upgrade — and the four SERVICE entries, which were not in the
     array at all. Without them every product resolved to
     `applied:false, canApply:false`, and platformActions.js:142 disables a
     circle that is neither: six dead circles on every row, which I then wrote
     into the design system as the product's behaviour.

     The real screen shows six enabled circles on nine of its ten rows
     (data/live/listings.real.capture.json) and one row with three disabled,
     so row 8 keeps its services unavailable and the page carries all three
     states, as the real one does.                                         */
  /* ── what each row is FOR ──────────────────────────────────────────────
     Ten rows that are all the same row prove one thing ten times. Every state
     this design system could not measure traced back to that: no listing was
     ever rejected, so the rejection popover never rendered and its size was
     invented; no listing carried a REGA expiry, so that popover did not exist
     either; nothing was ever booked, applied or pending.

     So each row now has a job. Row 0 is deliberately ORDINARY and stays that
     way — it is what every interaction step in harness/interactions/listings.mjs
     hovers and clicks, and a row that keeps changing shape is a row whose
     captures cannot be compared with yesterday's.

       0  the plain live listing — six enabled circles, seven row actions
       1  REJECTED, with reasons → the click popover in the Status cell, and
          the row shape a non-live listing has: 3 actions, NO upgrades cell
       2  a REGA expiry date → the "Expiring on" popover in the Property cell
       3  one product APPLIED and one service REQUESTED → the green tick, the
          warning badge, and the ActionPopOver with its expiry line
       4  DAILY RENTAL → Mark as Booked, the seventh row action
       5  discount_applicable FALSE → the six-action row, which is what made
          "five row actions" look like a rule for a week
       6  BOOKED dates → the Booked chip over the thumbnail and its tooltip
       7  PENDING-OTP-VERIFICATION → Publish Now instead of six circles, and
          the OTP modal behind it (otp_attempts 1; at >= 3 the product hides
          Publish and Delete entirely, which is a separate row worth having
          once there is somewhere to put it)
       8  services NOT applicable → the muted circle, and the one tooltip that
          is a plain string rather than a panel
       9  DAILY RENTAL again → so Mark as Booked has more than one entry point

     Everything else about a row is unchanged, so a change here moves exactly
     one thing on the screen. */
  const rejected = i === 1;
  const otpPending = i === 7;
  const dailyRental = i === 4 || i === 9;
  const disposition = rejected
    ? { slug: 'rejected', name: 'Rejected' }
    : otpPending
      ? { slug: 'pending-otp-verification', name: 'Pending OTP Verification' }
      : { slug: 'live', name: 'Live' };

  const applied = (slug) => r.product === slug.replace('-listing', '') || slug === 'basic-listing';
  const product = (slug) => ({ slug, is_applied: applied(slug), is_applicable: !applied(slug) });
  /* row 3 carries a real expiry so ActionPopOver has its "Expiring on" line
     (popoverContent.js:159) rather than rendering title-only */
  const appliedProduct = (slug) => ({
    slug, is_applied: true, is_applicable: false,
    expiry_date: day(-21).toISOString(),
    auto_renewable_item: { renewing_on: day(-21).toISOString() },
  });
  /* a service is applied only when its status is 'completed' (products.js:7);
     'requested' is the pending state, which draws RequestedStateIcon in the
     warning colour */
  const service = (slug, is_applicable = true) => ({ slug, status: null, is_applied: false, is_applicable });
  /* PENDING is `is_applied && status === 'requested'` — both, together
     (products.js:5-9). is_applied alone with status 'completed' is APPLIED;
     is_applied false makes the status field irrelevant, which is why a first
     attempt at this row came back reading "Request Photography Service" like
     any other. Nothing in this account had ever been requested, so
     RequestedStateIcon (upgrade-icons.js:58) had never rendered at all. */
  const requested = (slug) => ({
    slug, status: 'requested', is_applied: true, is_applicable: false,
    requested_at: day(2).toISOString(),
  });
  const servicesOff = i === 8;
  return {
    id: num(r.bayutId),
    price: num(r.price),
    beds: r.beds, baths: r.baths,
    completion_status: /Ready/.test(r.title) ? 'ready' : 'offplan',
    listing_category: { id: purpose.id, name: type, name_l1: type, external_id: 3, purpose_hash: purpose },
    area_unit: { id: 2, value: num(r.area), name: 'Sq. M.', name_l1: 'م²' },
    location: {
      title: area, title_l1: area,
      breadcrumbs: [
        { level: 1, title: 'Saudi Arabia', title_l1: 'السعودية' },
        { level: 2, title: city, title_l1: city },
        { level: 3, title: district, title_l1: district },
        { level: 4, title: area, title_l1: area },
      ],
    },
    images: [{ main: 1, sizes: { thumbnail: `/harness-img/${r.bayutId}.svg`, medium: `/harness-img/${r.bayutId}.svg` } }],
    images_count: r.images,
    ad_license: r.regaId,
    /* listingUtilities.js:220 — the sixth row action renders only when the
       backend says the listing is discountable AND the tenant flag is on
       (SHOW_LISTING_DISCOUNT_TAG is true for bayut). It was missing here, so
       the harness rendered five buttons and I wrote "five" into the design
       system. The action was reachable all along; the fixture hid it. */
    /* listingUtilities.js:220 — the sixth row action renders only when the
       backend says the listing is discountable. Row 5 says no, so the
       six-action row and the seven-action row are both on screen. */
    discount_applicable: i !== 5,
    /* listingDispositionMapper reads `rejection_reason` off the LISTING, not
       the platform listing (listingUtilities.js:100), and it is the presence
       of this array that makes the info icon render beside the Status pill */
    ...(rejected && { rejection_reason: ['Images do not match the property', 'Price is outside the expected range'] }),
    /* listingUtilities.js:238 gates Mark as Booked on this slug alone */
    ...(dailyRental && { listing_purpose: { id: 3, slug: 'daily-rental', title: 'Daily Rental', title_l1: 'إيجار يومي', name: 'Daily Rental' } }),
    /* a booked range puts the "Booked Until" chip over the thumbnail
       (listing-purpose.js:217) and is what its tooltip reads */
    ...(i === 6 && { additional_details: { booked_dates: [{ start_date: day(1).toISOString(), end_date: day(-6).toISOString() }] } }),
    expiry_days: 30,
    posted_at: posted.toISOString(),
    created_at: posted.toISOString(),
    updated_at: posted.toISOString(),
    area: num(r.area),
    /* the health popover reads a per-dimension score set; the chip reads the overall */
    health: {
      score: num(r.score), percentage_score: num(r.score), overall_percentage_score: num(r.score),
      classification: num(r.score) >= 80 ? 'high' : num(r.score) >= 50 ? 'medium' : 'low',
      age: 3 + i, age_percentage_score: 80, age_classification: 'high',
      exterior_images_count: 8, exterior_images_percentage_score: 100,
      interior_images_count: r.images - 8, interior_images_percentage_score: 100,
      duplicate_percentage_score: 100, unique_images_count: r.images, unique_images_percentage_score: 100, unique_images_classification: 'high',
      features_percentage_score: 50, features_classification: 'medium',
    },
    posted_by: { id: U.id, name: U.name },
    user: { id: U.id, name: U.name },
    platform_listings: [{
      /* the normaliser keys platforms by platform.slug and reads the contact's
         external_id for the stats call — without both, every row's stats stay 0 */
      id: 9900000 + i,
      platform: { id: 1, slug: 'ksa' },
      listing_id: num(r.bayutId),
      platform_listing_id: num(r.bayutId),
      contact_details: { id: U.id, external_id: U.platform_mapping.bayut.external_id },
      status: { slug: 'active', name: 'Active' },
      disposition,
      ...(otpPending && { otp_attempts: 1 }),
      /* transformers/listings.js:227 reads the expiry from here; without it
         the info icon beside the REGA id never renders at all */
      ...(i === 2 && { rega_info: { rega_details: { expiry_date: day(-120).toISOString() } } }),
      posted_at: posted.toISOString(),
      expiry_date: day(-28).toISOString(),
      products_information: i === 3
        ? [
            product('basic-listing'), product('hot-listing'), appliedProduct('signature-listing'),
            service('refresh'), requested('photography-service'),
            service('videography-service'), service('drone-footage-service'),
          ]
        : [
            product('basic-listing'), product('hot-listing'), product('signature-listing'),
            service('refresh', !servicesOff),
            service('photography-service', !servicesOff),
            service('videography-service', !servicesOff),
            service('drone-footage-service', !servicesOff),
          ],
    }],
    _row: r,   /* stripped before sending; used to build the stats overlay */
  };
});

const statsItems = listings.map((l) => ({
  ad_external_id: l.id,
  sum_search_count: num(l._row.views),
  sum_view_count: num(l._row.clicks),
  sum_lead_count: num(l._row.leads),
  sum_phone_view_count: Math.round(num(l._row.leads) / 3),
  sum_whatsapp_view_count: Math.round(num(l._row.leads) / 2),
  sum_sms_view_count: 0,
  sum_email_lead_count: 0,
}));

const clean = (l) => { const { _row, ...rest } = l; return rest; };

/* ── the performance chart: the same 30 points the HTML draws ──────────── */
const series = page.performance.chart.series;
const items = {};
series.forEach((v, i) => {
  items[iso(day(series.length - 1 - i))] = {
    sum_search_count: v,
    sum_view_count: Math.round(v * 0.0156),
    sum_lead_count: Math.round(v * 0.0005),
    sum_phone_view_count: Math.round(v * 0.00012),
    sum_whatsapp_view_count: Math.round(v * 0.00036),
    sum_sms_view_count: 0,
    sum_email_lead_count: 0,
    product_wise: [],
  };
});
const sum = (k) => Object.values(items).reduce((a, d) => a + d[k], 0);
const aggregates = {
  sum_search_count: sum('sum_search_count'), sum_view_count: sum('sum_view_count'),
  sum_lead_count: sum('sum_lead_count'), sum_phone_view_count: sum('sum_phone_view_count'),
  sum_whatsapp_view_count: sum('sum_whatsapp_view_count'), sum_sms_view_count: 0, sum_email_lead_count: 0,
};

/* ── the router ────────────────────────────────────────────────────────── */
const C = page.credits;
const products = Object.fromEntries(page.listings.products.map((p) => [p.title.toLowerCase(), p.value]));
const purposes = Object.fromEntries(page.listings.purposes.map((p) => [p.title, p.value]));

/* ── the member-area variant ───────────────────────────────────────────────
   appRoutes.js:83 — `isMemberArea = user && !user.is_package_user`. It is not
   a detail: the two variants share almost nothing at the top of the page.
   A member-area user gets the promo banner and the CreditsQuota widgets and
   NO FILTER BAR (ListingContainer.js:96 gates the bar on !isMemberArea); a
   package user gets the bar and neither of the others.

   The design system had only ever seen the package-user screen, so the banner,
   the credits card, its info drawer and its product tabs were not missing from
   the deliverable by oversight — nothing had ever rendered them to measure. */
const memberUser = {
  ...user,
  user: { ...user.user, is_package_user: false },
  banners: [{
    id: 1,
    title: 'Get a business package and enjoy exclusive benefits',
    description: 'Reach more buyers with more listings, more credits and priority support',
    cta_text: 'Buy Package',
  }],
};

const ROUTES = [
  [/^\/api\/surge\/users\/current$/,                 (search, mode) => (mode === 'member' ? memberUser : user)],
  /* the member area mounts the classified site's own header, which asks for
     these three before it will paint. A package user never calls them. */
  [/^\/api\/user\/favorites/,                        () => ({ favorites: [], pagination: { total_count: 0 } })],
  [/^\/api\/user\/searches\/saved/,                  () => ({ searches: [], pagination: { total_count: 0 } })],
  [/^\/api\/user\/bookings/,                         () => ({ bookings: [], count: 0, pagination: { total_count: 0 } })],
  [/^\/api\/surge\/users\/\d+$/,                     () => ({ user: { ...U, profile_image: AVATAR } })],
  [/^\/api\/surge\/agencies\/\d+\/licenses$/,          () => ({ licenses: [], pagination: {} })],
  /* Clicking an upgrade circle calls this before anything opens:
     tenant/bayut/apis/listings.js:167. The hook (useApplyProductModalData.js:172)
     shows "Product can not be applied" and opens NOTHING when the answer has no
     applicableProduct — which is why the six now-enabled circles still did
     nothing. The transformer reads res.bayut.products and res.bayut.credits.available. */
  [/^\/api\/surge\/products\/applicable_products/,    () => ({ bayut: {
      credits: { available: num(C.available) },
      products: [
        { id: 2, slug: 'hot-listing',           title: 'Hot Listing',       usage_type: 'credit', required_quantity: 5,  price: 5,  default_expiry_days: 30 },
        { id: 3, slug: 'signature-listing',     title: 'Signature Listing', usage_type: 'credit', required_quantity: 10, price: 10, default_expiry_days: 30 },
        { id: 4, slug: 'refresh',               title: 'Refresh',           usage_type: 'credit', required_quantity: 1,  price: 1,  default_expiry_days: 30 },
        { id: 5, slug: 'photography-service',   title: 'Photography',       usage_type: 'credit', required_quantity: 3,  price: 3,  default_expiry_days: 30 },
        { id: 6, slug: 'videography-service',   title: 'Videography',       usage_type: 'credit', required_quantity: 4,  price: 4,  default_expiry_days: 30 },
        { id: 7, slug: 'drone-footage-service', title: 'Drone Footage',     usage_type: 'credit', required_quantity: 6,  price: 6,  default_expiry_days: 30 },
      ],
  } })],
  [/^\/api\/surge\/products$/,                       () => ({ products: [] })],
  [/^\/api\/surge\/agencies\/\d+$/,                  () => ({ agency: { ...AGENCY, owner: { id: U.id, name: U.name }, users: [{ id: U.id, name: U.name, agency_admin: true, platform_mapping: U.platform_mapping }] } })],
  [/^\/api\/surge\/notifications\/stats$/,           () => ({ stats: { unread_notifications_count: U.unread_notifications_count } })],
  [/^\/api\/surge\/lms\/leads\/stats$/,              () => ({ stats: { unseen_leads_count: 0 } })],
  [/^\/api\/surge\/lms\/stats\//,                    () => ({ stats: { items: {} } })],
  [/^\/api\/surge\/(languages|area_units|experience_list)$/, () => ({})],
  [/^\/api\/surge\/statuses$/,                       () => ({ statuses: [] })],
  [/^\/api\/surge\/ad_license_requests$/,            () => ({ ad_license_requests: [], pagination: {} })],
  [/^\/api\/surge\/listings\/summary$/,              () => ({ summary: SUMMARY })],
  /* The tab IS a query param — listings.js:99 reads
     `f[nested.platform_listings.status.slug]` and passes the slug to
     listingTableColumnMapper, so each tab asks for a different set. Answering
     every tab with the same ten rows made the Draft and Removed captures a
     lie: Removed (0) rendered ten rows. The set follows the summary counts. */
  [/^\/api\/surge\/listings$/, (search) => {
      const slug = new URLSearchParams(search || '').get('f[nested.platform_listings.status.slug]') || 'active';
      const set = { active: listings, draft: listings.slice(0, SUMMARY.draft),
                    pending: listings.slice(0, SUMMARY.pending), removed: [] }[slug] || listings;
      const total = SUMMARY[slug] ?? SUMMARY.active;
      return {
        listings: set.map(clean),
        pagination: { current_page: 1, total_pages: Math.max(1, Math.ceil(total / 10)), total_count: total,
                      per_page: 10, from: set.length ? 1 : 0, to: set.length },
        statuses_and_dispositions: STATUSES,
      };
  }],
  [/^\/api\/surge\/ovation\/stats$/,                 () => ({ stats: { items: statsItems } })],
  [/^\/api\/surge\/ovation\/stats\/trends$/,         () => ({ stats: { aggregates, trends: { sum_search_count: 12.5, sum_view_count: -3.1, sum_lead_count: 8.0 } } })],
  [/^\/api\/surge\/ovation\/stats\/product_stats$/,  () => ({ stats: { items } })],
  [/^\/api\/surge\/dashboard\/listing_stats$/,       () => ({ stats: { ksa: {
      active: page.listings.active,
      sale: purposes['For Sale'], rent: purposes['To Rent'], daily_rental: purposes['Daily Rentals'],
      signature: products.signature, hot: products.hot, basic: products.basic,
  } } })],
  [/^\/api\/surge\/credits\/summary$/,               () => ({ credits_summary: { bayut: {
      available: num(C.available), used: num(C.used), allocated: num(C.total), expiring: 0,
      percentage_used: Math.round((num(C.used) / num(C.total)) * 10000) / 100,
      product_wise: [], current_package: { name: C.plan, slug: C.plan.toLowerCase().replace(/\s+/g, '_') },
  } } })],
  [/^\/api\/surge\/dashboard\/qc_summary$/,          () => ({})],
  /* the Delete Listing modal's radio list — surfaced by the state capture */
  [/^\/api\/surge\/reasons$/,                        () => ({ reasons: [
      { id: 1, title: 'Property is no longer available', name: 'Property is no longer available' },
      { id: 2, title: 'Rented out through Bayut',        name: 'Rented out through Bayut' },
      { id: 3, title: 'Sold through Bayut',              name: 'Sold through Bayut' },
      { id: 4, title: 'Rented out through another source', name: 'Rented out through another source' },
      { id: 5, title: 'Other',                           name: 'Other' },
  ] })],
  /* the notification centre popover */
  [/^\/api\/surge\/notifications$/,                  () => ({ notifications: [
      { id: 9001, title: 'Your listing is live', body: 'Apartment for Sale in Al Yarmuk is now live on Bayut.', is_read: false, created_at: new Date(Date.now() - 36e5).toISOString() },
      { id: 9002, title: 'Credits expiring soon', body: '2,120 credits expire at the end of this month.', is_read: false, created_at: new Date(Date.now() - 864e5).toISOString() },
      { id: 9003, title: 'TruCheck visit scheduled', body: 'A TruCheck visit is scheduled for Villa for Sale in Al Nahdah.', is_read: true, created_at: new Date(Date.now() - 3 * 864e5).toISOString() },
  ], pagination: { current_page: 1, total_pages: 1, total_count: 3, per_page: 10 } })],
];

/**
 * @param mode  the answer-set variant a capture step is running under.
 *   'member' makes /users/current a member-area user, which is the only way
 *   to render the banner and the CreditsQuota widgets. Handlers that do not
 *   care simply ignore it.
 */
export function answer(method, pathname, search = '', mode = null) {
  for (const [re, fn] of ROUTES) if (re.test(pathname)) return fn(search, mode);
  return undefined;
}

/* a 320×240 grey SVG for every listing thumbnail: the box is what matters, and
   an <img> takes its natural size from the SVG's width/height, so a tiny image
   would render tiny */
export const AVATAR_SVG = '<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'96\' height=\'96\' viewBox=\'0 0 96 96\'><rect width=\'96\' height=\'96\' fill=\'#d9dde3\'/><circle cx=\'48\' cy=\'36\' r=\'16\' fill=\'#aeb6c0\'/><path d=\'M16 96c0-17.7 14.3-32 32-32s32 14.3 32 32z\' fill=\'#aeb6c0\'/></svg>';

export const THUMB = {
  contentType: 'image/svg+xml',
  body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" fill="#d9dde3"/><path d="M0 240 L110 130 L180 200 L230 150 L320 240Z" fill="#c4c9d1"/><circle cx="250" cy="70" r="26" fill="#eef0f3"/></svg>',
};
