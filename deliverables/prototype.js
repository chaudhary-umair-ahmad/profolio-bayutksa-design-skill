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

  function open(id, trigger) {
    var el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    openStack.push({ el: el, trigger: trigger || null });
    /* a drawer needs its own mask; a modal's mask IS the element */
    var mask = el.getAttribute('data-mask');
    if (mask) { var m = document.getElementById(mask); if (m) m.hidden = false; }
    document.body.style.overflow = 'hidden';
    var first = el.querySelector(FOCUSABLE);
    if (first) first.focus();
  }

  function close(el) {
    var i = openStack.map(function (o) { return o.el; }).lastIndexOf(el);
    if (i < 0) return;
    var rec = openStack.splice(i, 1)[0];
    el.hidden = true;
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
    Array.prototype.forEach.call(document.querySelectorAll('[data-state-panel]'), function (p) {
      p.hidden = p.getAttribute('data-state-panel') !== name;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.pf-proto-bar button'), function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-state-set') === name));
    });
    try { history.replaceState(null, '', '#state=' + name); } catch (e) { /* file:// refuses */ }
  }

  /* ── wiring ──────────────────────────────────────────────────────────── */

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-open],[data-close],[data-panel],[data-state-set]');

    if (t) {
      if (t.hasAttribute('data-open')) { e.preventDefault(); open(t.getAttribute('data-open'), t); return; }
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
