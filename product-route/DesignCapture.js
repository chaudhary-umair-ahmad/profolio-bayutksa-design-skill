/**
 * /design-capture — a page whose only job is to be measured.
 *
 * WHY THIS EXISTS
 * The design system is rebuilt from the product, and every value in it has to
 * come from a render rather than from reading source. Two things have made
 * that hard:
 *
 *   1. A screen only shows the states its ACCOUNT happens to have. A listing
 *      with no discount offer renders five row actions, an account with no
 *      credits renders six dead upgrade circles — and both of those went into
 *      the design system as rules about the product before a second account
 *      proved otherwise.
 *   2. antd v5 is CSS-in-JS. A component that has never rendered has neither
 *      markup nor styles in the page, so a saved copy of a real screen
 *      contains no modal, no drawer and no popover — only what was open.
 *
 * This route answers both. It renders every component in every state, with the
 * real theme, the real antd and the real styled-components, and it renders the
 * OVERLAYS INLINE (`getContainer={false}`) so their markup and their generated
 * CSS are present in a single saved page. Save it once with SingleFile and the
 * whole vocabulary comes across, pixel for pixel.
 *
 * It has no data, no API calls and no redux. That is deliberate: it is a
 * public route, so it needs no login and cannot show anybody's information.
 *
 * NOT FOR PRODUCTION. appRoutes.js registers it only when the environment is
 * not production. Delete this file and its two registration lines to remove it
 * entirely; nothing else imports it.
 *
 * Each specimen carries `data-spec="<name>"`. That attribute is the contract:
 * the design system's walker reads it to know which component it is looking
 * at, so a specimen can move on the page without breaking anything.
 */
import React from 'react';
import tenantTheme from '@theme';
import {
  Alert,
  Button,
  Drawer,
  EmptyState,
  Heading,
  Icon,
  Modal,
  Popover,
  Select,
  Skeleton,
  Spinner,
  Tag,
  TextInput,
} from '../../../components/common';

/* The page frames specimens and paints nothing else. Any styling here would be
   a value the design system might mistake for the product's. */
/* The walker that measures this page DROPS data-* attributes on purpose — a
   capture records how a page looks, never what it says, and data-* is where
   applications put content. So the specimen name is carried as a CLASS as
   well: `spec-modal-default` survives the walk, `data-spec` does not. Keep
   both — the attribute is what a human greps for in a saved file. */
const specClass = (name) => `spec spec-${String(name).replace(/[^a-z0-9]+/gi, '-')}`;

const Spec = ({ name, children, note }) => (
  <section data-spec={name} className={specClass(name)} style={{ padding: '16px 0', borderBlockEnd: '1px solid #f0f0f0' }}>
    <div style={{ font: '11px/1.6 ui-monospace, monospace', color: '#9D9D9D' }}>
      {name}
      {note ? ` — ${note}` : ''}
    </div>
    <div data-spec-body style={{ paddingBlockStart: 8, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      {children}
    </div>
  </section>
);

/* Rendered inline rather than portalled, so that one saved page carries the
   overlay's markup AND the CSS antd injects the first time it mounts.

   `getContainer={false}` puts the overlay in this section's DOM, but antd
   still positions it `fixed`, so without help every modal would stack in the
   middle of the viewport on top of the others. `transform: translateZ(0)`
   makes this section a containing block for fixed descendants, which confines
   each overlay — and its mask — to its own box. Worth knowing when measuring:
   a composited layer also makes the browser rasterise text greyscale instead
   of subpixel, which is what the product's own screens do anyway. */
const Inline = ({ name, children, height = 420 }) => (
  <section data-spec={name} className={specClass(name)} style={{ padding: '16px 0', borderBlockEnd: '1px solid #f0f0f0' }}>
    <div style={{ font: '11px/1.6 ui-monospace, monospace', color: '#9D9D9D' }}>{name}</div>
    <div
      data-spec-body
      style={{ position: 'relative', transform: 'translateZ(0)', height, overflow: 'hidden', marginBlockStart: 8 }}
    >
      {children}
    </div>
  </section>
);

const BUTTON_TYPES = ['primary', 'default', 'link', 'ghost', 'primary-light', 'danger'];
const SIZES = ['small', 'default', 'large'];

const DesignCapture = () => (
  <main data-design-capture="1" style={{ maxWidth: 1280, margin: '0 auto', padding: 24 }}>
    <Heading as="h4">Design capture</Heading>
    <p style={{ color: '#707070' }}>
      Every component, every state, rendered with the real theme. Save this page with SingleFile.
    </p>

    {/* ── type ──────────────────────────────────────────────────────────── */}
    <Spec name="type/headings">
      <Heading as="h1">Heading 1</Heading>
      <Heading as="h4">Heading 4</Heading>
      <Heading as="h5">Heading 5</Heading>
    </Spec>
    <Spec name="type/body" note="base, muted, small">
      <span>Body text</span>
      <span style={{ color: tenantTheme.gray700 }}>Muted text</span>
      <span className="fz-12">Small text</span>
    </Spec>

    {/* ── buttons: every type at every size, plus the states that render ── */}
    {BUTTON_TYPES.map((type) => (
      <Spec key={type} name={`button/${type}`} note="small · default · large · disabled · loading">
        {SIZES.map((size) => (
          <Button key={size} type={type} size={size}>
            {size}
          </Button>
        ))}
        <Button type={type} disabled>
          disabled
        </Button>
        <Button type={type} loading>
          loading
        </Button>
        <Button type={type} icon="FiSearch">
          with icon
        </Button>
        <Button type={type} shape="circle" icon="MdEdit" />
      </Spec>
    ))}

    {/* ── the row-action and upgrade circles, in all three states ───────── */}
    {/* the upgrade circle carries the product's colour at 10% — products.js
        passes `color` and `iconColor` into the same Button */}
    <Spec name="round-action/states" note="enabled · disabled · row action — the three the listings table uses">
      <Button shape="circle" icon="IconSuperHot" color={tenantTheme['color-hot']} iconColor={tenantTheme['color-hot']} />
      <Button shape="circle" icon="IconSuperHot" color={tenantTheme['color-hot']} iconColor={tenantTheme['color-hot']} disabled />
      <Button shape="circle" icon="BsFillLightningChargeFill" color={tenantTheme['color-signature']} iconColor={tenantTheme['color-signature']} />
      <Button shape="circle" icon="HiOutlineTrash" color={tenantTheme['primary-color']} iconColor={tenantTheme['primary-color']} />
    </Spec>

    {/* ── tags and pills ────────────────────────────────────────────────── */}
    <Spec name="tag/product">
      <Tag color={tenantTheme['color-basic']}>Basic</Tag>
      <Tag color={tenantTheme['color-hot']}>Hot</Tag>
      <Tag color={tenantTheme['color-signature']}>Signature</Tag>
    </Spec>

    {/* ── form controls ─────────────────────────────────────────────────── */}
    <Spec name="input/text" note="placeholder · filled · disabled">
      <TextInput placeholder="Enter Listing ID" />
      <TextInput value="88240117" onChange={() => {}} />
      <TextInput placeholder="Disabled" disabled />
    </Spec>
    <Spec name="select" note="placeholder · disabled">
      <Select placeholder="Select Purpose" style={{ width: 240 }} options={[]} />
      <Select placeholder="Disabled" style={{ width: 240 }} options={[]} disabled />
    </Spec>

    {/* ── feedback ──────────────────────────────────────────────────────── */}
    <Spec name="alert" note="every type">
      {['info', 'success', 'warning', 'error'].map((t) => (
        <Alert key={t} type={t} message={`${t} message`} />
      ))}
    </Spec>
    <Spec name="spinner">
      <Spinner />
    </Spec>
    <Spec name="skeleton">
      <Skeleton />
    </Spec>
    <Spec name="empty-state" note="type=table is what an empty listings tab renders">
      <EmptyState type="table" />
    </Spec>

    {/* ── icons: the sprite the design system ships is built from these ── */}
    <Spec name="icons" note="each carries its own name so the sprite can be checked against the source">
      {[
        'SideMenuDashboard', 'PostListingIcon', 'MyListingIcon', 'SideMenuQuota', 'AgentPerformanceIcon',
        'SideMenuReports', 'SideMenuAgency', 'IoSettingsOutline', 'SideMenuPropShop', 'TruCheckIcon',
        'IconSellRentListing', 'FiArrowUpRight', 'IoMdEye', 'MdEdit', 'HiOutlineTrash', 'IconSuperHot',
        'BsFillLightningChargeFill', 'MdRefresh', 'HiCamera', 'HiVideoCamera', 'DroneIcon', 'FiSearch',
        'MdOutlineDoubleArrow', 'GrNotification', 'FiUser', 'FiLogOut', 'PiSealCheckFill', 'GoDotFill',
      ].map((name) => (
        <span key={name} data-icon={name} title={name}>
          <Icon icon={name} size="1.4em" />
        </span>
      ))}
    </Spec>

    {/* ── overlays, rendered IN PLACE ───────────────────────────────────── */}
    <Inline name="modal/default">
      <Modal
        visible
        getContainer={false}
        title="Delete Listing"
        okText="Delete"
        cancelText="Cancel"
        onCancel={() => {}}
        onOk={() => {}}
      >
        <p>Why are you deleting your listing?</p>
      </Modal>
    </Inline>

    <Inline name="modal/small">
      <Modal visible getContainer={false} width={360} title="Get the Bayut KSA App" footer={null} onCancel={() => {}}>
        <p>Scan the QR code to download the app</p>
      </Modal>
    </Inline>

    <Inline name="drawer/right" height={520}>
      <Drawer
        visible
        open
        getContainer={false}
        placement="right"
        width={450}
        title="Filters"
        onClose={() => {}}
        mask={false}
      >
        <p>Apply filters to organize data accordingly</p>
      </Drawer>
    </Inline>

    <Inline name="popover">
      <Popover
        open
        visible
        placement="bottom"
        title="Notifications"
        content={<div style={{ width: 560 }}>Notification list</div>}
        getPopupContainer={(node) => node.parentElement}
      >
        <Button type="default">popover anchor</Button>
      </Popover>
    </Inline>
  </main>
);

export default DesignCapture;
