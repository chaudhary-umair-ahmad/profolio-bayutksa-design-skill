/**
 * The interaction layer for the Profolio KSA prototypes.
 *
 * These pages are reference reproductions first: every class is catalogued in
 * components.html and every value is sourced. This file is what makes them
 * walkable — open a modal, switch a tab, see the empty state — without turning
 * a page into an application.
 *
 * It is entirely DATA-ATTRIBUTE DRIVEN, so a page stays declarative markup and
 * never carries logic of its own:
 *
 *   <button data-open="modal-delete">        opens #modal-delete
 *   <button data-close>                      closes the overlay it sits in
 *   <div class="pf-mask" id="modal-delete">  an overlay; clicking the mask closes it
 *
 *   <button class="pf-tab" data-panel="tab-draft">   shows [data-panel-id="tab-draft"]
 *                                                    and hides its siblings
 *
 *   <div data-state-panel="empty">           a page state; the bar switches between them
 *
 *   <button data-tip="Mark Signature">        shows the shared #pf-tip beside it
 *   <button data-open="popover-leads" data-hover>   opens on hover, not click
 *   <div class="pf-popover" data-anchor="trigger" data-placement="right">
 *                                            positioned beside whatever opened it
 *   <button data-noop="the pager is a URL push">
 *                                            does nothing ON PURPOSE, and says why
 *
 * The last one matters more than it looks. A prototype has controls that
 * cannot do anything here — a pager that is a server round-trip, a "mark all
 * as read" that mutates data. Leaving them inert makes them indistinguishable
 * from the ones nobody has got to yet, so scripts/census.mjs counts a
 * data-noop as ACKNOWLEDGED and everything else without a target as DEAD.
 * Dead is the number authoring/listings-buttons.md exists to drive to zero.
 *
 * Esc closes the topmost overlay, focus is trapped while one is open and
 * restored to the trigger on close — the product's behaviour, and the part
 * most prototypes skip.
 *
 * No framework, no build step, no network. bundle.mjs inlines it so a single
 * file still works offline.
 */
(function () {
  'use strict';

  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var openStack = [];

  /* ── overlays ────────────────────────────────────────────────────────── */

  function overlayOf(el) {
    return el.closest('.pf-mask, .pf-drawer, .pf-popover');
  }

  /* ── anchoring ────────────────────────────────────────────────────────
     A shell popover sits at a fixed corner, so a CSS rule places it. The
     table-body popovers cannot: there are thirteen rows and one popover of
     each kind, so where it goes depends on which trigger opened it. This is
     the one piece of geometry the prototype computes rather than declares. */

  var GAP = 8;   /* the arrow's reach — antd's popover sits clear of its anchor */

  function anchor(el, trigger, placement) {
    if (!trigger) return;
    var r = trigger.getBoundingClientRect();
    var sx = window.pageXOffset, sy = window.pageYOffset;
    /* measure the panel where it already is, before moving it */
    var w = el.offsetWidth, h = el.offsetHeight;
    var top, left;

    if (placement === 'right')      { top = r.top + sy + r.height / 2 - h / 2; left = r.right + sx + GAP; }
    else if (placement === 'left')  { top = r.top + sy + r.height / 2 - h / 2; left = r.left + sx - w - GAP; }
    else if (placement === 'bottom'){ top = r.bottom + sy + GAP;               left = r.left + sx + r.width / 2 - w / 2; }
    else                            { top = r.top + sy - h - GAP;              left = r.left + sx + r.width / 2 - w / 2; }

    /* keep it on the page — a popover half off the right edge is not a
       measurement anybody can use */
    var maxLeft = document.documentElement.scrollWidth - w - GAP;
    el.style.top = Math.max(GAP, top) + 'px';
    el.style.left = Math.max(GAP, Math.min(left, maxLeft)) + 'px';
  }

  function open(id, trigger) {
    var el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    if (el.getAttribute('data-anchor') === 'trigger') {
      anchor(el, trigger, (trigger && trigger.getAttribute('data-placement')) || el.getAttribute('data-placement'));
    }
    openStack.push({ el: el, trigger: trigger || null });
    /* a drawer needs its own mask; a modal's mask IS the element */
    var mask = el.getAttribute('data-mask');
    if (mask) { var m = document.getElementById(mask); if (m) m.hidden = false; }
    /* only a MASKED overlay locks the page; a popover leaves it scrollable,
       which is what the product does */
    if (el.classList.contains('pf-mask') || el.hasAttribute('data-mask')) document.body.style.overflow = 'hidden';
    /* a hover popover must not steal focus — the pointer is still moving */
    if (!el.hasAttribute('data-hovered')) {
      var first = el.querySelector(FOCUSABLE);
      if (first) first.focus();
    }
  }

  function close(el) {
    var i = openStack.map(function (o) { return o.el; }).lastIndexOf(el);
    if (i < 0) return;
    var rec = openStack.splice(i, 1)[0];
    el.hidden = true;
    el.removeAttribute('data-hovered');
    var mask = el.getAttribute('data-mask');
    if (mask) { var m = document.getElementById(mask); if (m) m.hidden = true; }
    if (!openStack.length) document.body.style.overflow = '';
    if (rec.trigger && document.contains(rec.trigger)) rec.trigger.focus();
  }

  function closeTop() {
    if (openStack.length) close(openStack[openStack.length - 1].el);
  }

  /* ── tabs and panels ─────────────────────────────────────────────────── */

  function selectTab(btn) {
    var group = btn.closest('[role="tablist"]') || btn.parentElement;
    var panelId = btn.getAttribute('data-panel');

    Array.prototype.forEach.call(group.querySelectorAll('[data-panel]'), function (b) {
      b.setAttribute('aria-selected', String(b === btn));
    });
    if (!panelId) return;
    /* only panels in the same set move, so two tab groups on one page do not
       fight over each other */
    var all = document.querySelectorAll('[data-panel-id]');
    var names = Array.prototype.map.call(group.querySelectorAll('[data-panel]'), function (b) {
      return b.getAttribute('data-panel');
    });
    Array.prototype.forEach.call(all, function (p) {
      var id = p.getAttribute('data-panel-id');
      if (names.indexOf(id) < 0) return;
      p.hidden = id !== panelId;
    });
  }

  /* ── page states ─────────────────────────────────────────────────────── */

  function setState(name) {
    /* the state is also an attribute on <body>, so a rule can dress what sits
       outside the panel — the loading state dims the Search button */
    document.body.setAttribute('data-page-state', name);
    Array.prototype.forEach.call(document.querySelectorAll('[data-state-panel]'), function (p) {
      p.hidden = p.getAttribute('data-state-panel') !== name;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.pf-proto-bar button'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-state-set') === name));
    });
    try { history.replaceState(null, '', '#state=' + name); } catch (e) { /* file:// refuses */ }
  }

  /* ── the shared tooltip ───────────────────────────────────────────────
     One element for the whole page. The product has a Tooltip on all six
     upgrade circles and all seven row actions of every row — ninety on this
     screen — and ninety copies of the same markup would be a worse reference
     than one, not a better one. The text is the trigger's own data-tip. */

  function tipFor(trigger) {
    var tip = document.getElementById('pf-tip');
    if (!tip) return;
    tip.textContent = trigger.getAttribute('data-tip');
    tip.hidden = false;
    anchor(tip, trigger, trigger.getAttribute('data-placement') || 'top');
  }

  function hideTip() {
    var tip = document.getElementById('pf-tip');
    if (tip) tip.hidden = true;
  }

  /* ── wiring ──────────────────────────────────────────────────────────── */

  /* Hover, for the six popovers and the tooltip that open that way in the
     product. mouseover/mouseout rather than mouseenter, because these are
     delegated from the document and enter does not bubble. */
  document.addEventListener('mouseover', function (e) {
    var tipped = e.target.closest('[data-tip]');
    if (tipped) tipFor(tipped);

    var t = e.target.closest('[data-open][data-hover]');
    if (!t) return;
    var id = t.getAttribute('data-open');
    var el = document.getElementById(id);
    if (!el || !el.hidden) return;
    el.setAttribute('data-hovered', '');
    open(id, t);
  });

  document.addEventListener('mouseout', function (e) {
    var tipped = e.target.closest('[data-tip]');
    if (tipped && !tipped.contains(e.relatedTarget)) hideTip();

    var t = e.target.closest('[data-open][data-hover]');
    if (!t) return;
    var el = document.getElementById(t.getAttribute('data-open'));
    if (!el || el.hidden) return;
    /* moving INTO the popover keeps it open — the product's popovers are
       interactive, and the health one has three buttons in it */
    if (e.relatedTarget && (t.contains(e.relatedTarget) || el.contains(e.relatedTarget))) return;
    close(el);
  });

  /* leaving the popover itself closes it, unless the pointer went back to the
     thing that opened it */
  document.addEventListener('mouseout', function (e) {
    var el = e.target.closest('.pf-popover[data-hovered]');
    if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
    var rec = openStack[openStack.length - 1];
    if (rec && rec.el === el && !(e.relatedTarget && rec.trigger && rec.trigger.contains(e.relatedTarget))) close(el);
  });

  /* keyboard parity: a tooltip that only exists on hover is not reachable */
  document.addEventListener('focusin', function (e) {
    var t = e.target.closest('[data-tip]');
    if (t) tipFor(t); else hideTip();
  });


  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open],[data-close],[data-panel],[data-state-set]');

    if (t) {
      if (t.hasAttribute('data-open')) {
        e.preventDefault();
        var el = document.getElementById(t.getAttribute('data-open'));
        /* a hover trigger has already opened it; clicking must not stack it.
           But clicking (or Entering) a hover popover is how a keyboard or
           touch user gets INTO it — the health panel has three buttons — so
           the click takes it out of hover mode and moves focus in. Leaving it
           in hover mode would mean the only way to reach those buttons is a
           mouse, which is not a component anybody can ship. */
        if (el && !el.hidden) {
          if (el.hasAttribute('data-hovered')) {
            el.removeAttribute('data-hovered');
            var f = el.querySelector(FOCUSABLE);
            if (f) f.focus();
          }
        } else {
          open(t.getAttribute('data-open'), t);
        }
        return;
      }
      if (t.hasAttribute('data-close')) { e.preventDefault(); var o = overlayOf(t); if (o) close(o); return; }
      if (t.hasAttribute('data-panel')) { e.preventDefault(); selectTab(t); return; }
      if (t.hasAttribute('data-state-set')) { e.preventDefault(); setState(t.getAttribute('data-state-set')); return; }
    }

    /* clicking the mask itself — but not the dialog sitting on it — closes */
    var top = openStack[openStack.length - 1];
    if (top && e.target === top.el && top.el.classList.contains('pf-mask')) { close(top.el); return; }

    /* a popover is not masked, so it closes on any click outside it */
    if (top && top.el.classList.contains('pf-popover') && !top.el.contains(e.target)) close(top.el);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeTop(); return; }

    if (e.key !== 'Tab' || !openStack.length) return;
    /* trap focus in the topmost overlay */
    var el = openStack[openStack.length - 1].el;
    var items = Array.prototype.filter.call(el.querySelectorAll(FOCUSABLE), function (n) {
      return n.offsetParent !== null;
    });
    if (!items.length) return;
    var first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ── deep links ──────────────────────────────────────────────────────
     `listings.html#state=modal-delete` puts the page into that state, whatever
     kind of state it is. One name, one address: it is also how qa-design.mjs
     reaches a state, so every name the harness captured
     (data/live/listings--<name>.png) has to resolve here or the QA says so. */

  function goTo(name) {
    var el = document.getElementById(name);
    if (el && /pf-mask|pf-drawer|pf-popover/.test(el.className)) { open(name, null); return true; }
    var tab = document.querySelector('[data-panel="' + name + '"]');
    if (tab) { selectTab(tab); return true; }
    if (document.querySelector('[data-state-panel="' + name + '"]')) { setState(name); return true; }
    return false;
  }
  window.pfGoTo = goTo;

  var m = /(?:^|#|&)state=([\w-]+)/.exec(location.hash);
  if (m) goTo(m[1]);
})();
