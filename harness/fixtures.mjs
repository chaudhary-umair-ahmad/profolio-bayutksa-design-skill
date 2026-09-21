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
const SUMMARY = { active: page.listings.active, draft: 2, pending: 1, removed: 0 };

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
  const applied = (slug) => ({ slug, is_applied: r.product === slug.replace('-listing', '') || slug === 'basic-listing' });
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
      disposition: { slug: 'live', name: 'Live' },
      posted_at: posted.toISOString(),
      expiry_date: day(-28).toISOString(),
      products_information: [applied('basic-listing'), applied('hot-listing'), applied('signature-listing')],
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

const ROUTES = [
  [/^\/api\/surge\/users\/current$/,                 () => user],
  [/^\/api\/surge\/users\/\d+$/,                     () => ({ user: { ...U, profile_image: AVATAR } })],
  [/^\/api\/surge\/agencies\/\d+\/licenses$/,          () => ({ licenses: [], pagination: {} })],
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

export function answer(method, pathname, search = '') {
  for (const [re, fn] of ROUTES) if (re.test(pathname)) return fn(search);
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
