/**
 * /design-capture/flows — the My Listings overlays, opened and held open.
 *
 * The sibling route (/design-capture) renders the component vocabulary.
 * This one renders the FLOWS: the real modals and drawers a listings row can
 * open, mounted from the same files the table mounts them from, and opened on
 * mount through the same refs the row actions use.
 *
 * The inventory is not invented. tenant/bayut/components/listing/
 * listing-row-actions/listing-row-actions.js:89 defines exactly six things a
 * row can do:
 *
 *   showDeleteListingModal   → ConfirmationModal + the reason list   (here)
 *   trucheckModal            → TruCheckModal                         (here)
 *   showBookingModal         → BookingModal, daily-rental only       (here)
 *   showListingDetail        → ListingDrawer                         (here)
 *   showEditListingPage      → navigates to /post-listing/:id        (not an overlay)
 *   showListingOnClassified  → opens the classified site             (not an overlay)
 *
 * WHY A BOUNDARY PER SPECIMEN
 * These components are built for a page that has a listing, a store and an
 * API. Here they have a static item and no server. Some will render fully,
 * some will render their chrome and fail inside, and which is which is not
 * worth guessing — so each one is isolated. A specimen that throws reports
 * itself and the rest of the page still saves. The point is to come away with
 * whatever renders, not to have one failure blank the capture.
 *
 * A NOTE ON WHERE THEY LAND. `getContainer={false}` only works where the
 * wrapper forwards it. ConfirmationModal and TruCheckModal do, so they render
 * inside their own section. BookingModal and ListingDrawer do not, so antd
 * portals them to <body> and they float over the page. Both are still fully
 * captured — markup and generated CSS are in the saved file either way — but
 * they overlap everything else, so `?only=<name>` renders one flow at a time:
 *
 *   /design-capture/flows                  every flow, one save, overlapping
 *   /design-capture/flows?only=booking     just that one, clean
 *
 * Forwarding getContainer through those two components would be tidier and is
 * a change to product code rather than an addition beside it, which is not a
 * trade worth making for a measurement aid.
 *
 * Public route, no login, no data of anybody's. Never registered in production.
 */
import React from 'react';
import { Radio, Typography } from 'antd';
import { ConfirmationModal, Spinner, TextInput, Title } from '../../../components/common';
import ListingDrawer from '../../../components/listing-drawer/listingDrawer';
import TruCheckModal from '../../../components/trucheckmodal/trucheckModal';
import BookingModal from '../../../components/bookedUntilModal/bookedUnitilModal';

/* A listing shaped the way the row actions expect one, with nothing real in
   it. Every id is invented and no request made with it can succeed, which is
   the intended outcome: the chrome is what is being measured. */
const ITEM = {
  id: 1,
  property_id: 1,
  slug: 'ksa',
  title: 'Villa for Sale | Ready',
  purposeId: 1,
  listing_purpose: { slug: 'daily-rental' },
  trucheck: { current_trucheck: { status: { slug: 'eligible' } } },
  platforms: { ksa: { products_information: {} } },
};

const REASONS = [
  { id: 1, name: 'Property is no longer available', slug: 'not-available' },
  { id: 2, name: 'Rented out through Bayut', slug: 'rented-bayut' },
  { id: 3, name: 'Sold through Bayut', slug: 'sold-bayut' },
  { id: 4, name: 'Rented out through another source', slug: 'rented-other' },
  { id: 5, name: 'Other', slug: 'other', is_text_required: true },
];

class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div data-spec-error style={{ font: '12px/1.6 ui-monospace, monospace', color: '#f73131' }}>
          did not render here — {String(this.state.error).slice(0, 160)}
        </div>
      );
    }
    return this.props.children;
  }
}

/* Same containing-block trick as the sibling route: getContainer={false} keeps
   antd's fixed positioning, so without a composited ancestor every overlay
   would stack in the middle of the viewport. */
const Flow = ({ name, children, height = 520 }) => (
  <section data-spec={name} style={{ padding: '16px 0', borderBlockEnd: '1px solid #f0f0f0' }}>
    <div style={{ font: '11px/1.6 ui-monospace, monospace', color: '#9D9D9D' }}>{name}</div>
    <div
      data-spec-body
      style={{ position: 'relative', transform: 'translateZ(0)', height, overflow: 'hidden', marginBlockStart: 8 }}
    >
      <Boundary>{children}</Boundary>
    </div>
  </section>
);

/* The ref-driven overlays open themselves on mount, the same call the row
   action makes. */
const OnMount = ({ open, children }) => {
  const ref = React.useRef();
  React.useEffect(() => {
    const id = setTimeout(() => {
      try {
        open(ref);
      } catch (e) {
        /* the boundary cannot catch an async throw; the specimen simply stays shut */
      }
    }, 100);
    return () => clearTimeout(id);
  }, []);
  return children(ref);
};

const DesignCaptureFlows = () => {
  const only = new URLSearchParams(window.location.search).get('only');
  const shows = (name) => !only || name === only || name === `flow/${only}`;

  return (
  <main data-design-capture="flows" style={{ maxWidth: 1280, margin: '0 auto', padding: 24 }}>
    <Title level={4}>My Listings — flows</Title>
    <p style={{ color: '#707070' }}>
      The real overlays a listings row opens, held open. Save this page with SingleFile.
      {' '}Add <code>?only=booking</code> to render one at a time — BookingModal and ListingDrawer
      portal to the body and otherwise cover the rest.
    </p>

    {/* ── delete: the modal AND its reason list, which is the part that
        matters — the list is what makes it more than a confirm box ─────── */}
    {shows('flow/delete-listing') && (
    <Flow name="flow/delete-listing" height={560}>
      <OnMount open={(ref) => ref.current && ref.current.showModal()}>
        {(ref) => (
          <ConfirmationModal
            ref={ref}
            getContainer={false}
            title="Delete Listing"
            okText="Delete"
            cancelText="Cancel"
            onConfirm={() => {}}
          >
            <Title className="mb-16" level={5}>
              Why are you deleting your listing?
            </Title>
            <Radio.Group value={5}>
              {REASONS.map((option) => (
                <div key={option.id}>
                  <Radio className="color-gray-dark" value={option.id}>
                    {option.name}
                  </Radio>
                </div>
              ))}
            </Radio.Group>
            <TextInput placeholder="Please specify" />
          </ConfirmationModal>
        )}
      </OnMount>
    </Flow>
    )}

    {shows('flow/trucheck') && (
    <Flow name="flow/trucheck">
      <OnMount open={(ref) => ref.current && ref.current.show(ITEM)}>
        {(ref) => <TruCheckModal ref={ref} getContainer={false} />}
      </OnMount>
    </Flow>
    )}

    {shows('flow/booking') && (
    <Flow name="flow/booking" height={560}>
      <OnMount open={(ref) => ref.current && ref.current.show(ITEM)}>
        {(ref) => <BookingModal ref={ref} getContainer={false} />}
      </OnMount>
    </Flow>
    )}

    {shows('flow/listing-detail-drawer') && (
    <Flow name="flow/listing-detail-drawer" height={640}>
      <OnMount open={(ref) => ref.current && ref.current.open(ITEM.id)}>
        {(ref) => <ListingDrawer ref={ref} getContainer={false} />}
      </OnMount>
    </Flow>
    )}
  </main>
  );
};

export default DesignCaptureFlows;
