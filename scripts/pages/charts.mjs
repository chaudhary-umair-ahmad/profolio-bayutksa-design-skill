/**
 * Charts, drawn as SVG.
 *
 * The product plots with a charting library; this design system ships no
 * JavaScript beyond prototype.js, so for a while a chart here was a grey
 * rectangle with the word "Chart" in it. That is not a placeholder, it is a
 * missing component: Reports Summary is mostly chart, and a page that is
 * mostly grey box is not a design system for that page.
 *
 * These draw the real shapes with plain SVG — a ring with a dash offset, a
 * polyline over a dashed grid — at the sizes measured from
 * data/live/reports-*.capture.json. The numbers come from the fixture, so a
 * chart here is as honest as the rest of the page: it shows what the fixture
 * account's screen showed.
 */
import { esc } from './shell.mjs';

/**
 * A ring. 128x128 on Breakdown By Location, where an empty series draws the
 * track alone and the centre carries the total over its label.
 */
export const donut = ({ size = 128, thickness = 14, series = [], value, label, track = 'var(--border-light)' }) => {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = series.reduce((a, s) => a + s.value, 0);
  let at = 0;
  const arcs = series.map((s) => {
    const len = total ? (s.value / total) * c : 0;
    const seg = `<circle class="pf-donut-seg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thickness}" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-at).toFixed(2)}"/>`;
    at += len;
    return seg;
  }).join('');
  return `<div class="pf-donut" style="--donut:${size}px">
                <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(label || 'Breakdown')}">
                  <g transform="rotate(-90 ${size / 2} ${size / 2})">
                    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${thickness}"/>
                    ${arcs}
                  </g>
                </svg>
${value !== undefined ? `                <div class="pf-donut-centre"><span class="pf-donut-value">${esc(value)}</span>${label ? `<span class="pf-donut-label">${esc(label)}</span>` : ''}</div>` : ''}
              </div>`;
};

/**
 * A line chart with a dashed y-grid, y-axis ticks and rotated x labels —
 * 1282x273 on Reports Summary, the same component on Leads & Reach.
 */
export const lineChart = ({ w = 1282, h = 273, points = [], labels = [], max = 2500, step = 500 }) => {
  const padL = 46, padB = 58, padT = 8, padR = 8;
  const pw = w - padL - padR, ph = h - padT - padB;
  const x = (i) => padL + (points.length > 1 ? (i / (points.length - 1)) * pw : 0);
  const y = (v) => padT + ph - (v / max) * ph;
  const ticks = [];
  for (let v = 0; v <= max; v += step) ticks.push(v);
  const grid = ticks.map((v) => `<line class="pf-grid" x1="${padL}" x2="${w - padR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`).join('');
  const yLabels = ticks.map((v) => `<text class="pf-axis" x="${padL - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${v}</text>`).join('');
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  const dots = points.map((p, i) => `<circle class="pf-dot" cx="${x(i).toFixed(1)}" cy="${y(p).toFixed(1)}" r="2.5"/>`).join('');
  const xLabels = labels.map((l, i) => `<text class="pf-axis" transform="translate(${x(i).toFixed(1)} ${(padT + ph + 14).toFixed(1)}) rotate(-45)" text-anchor="end">${esc(l)}</text>`).join('');
  return `            <div class="pf-linechart">
              <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" role="img" aria-label="Views, clicks and leads over time">
                ${grid}
                <line class="pf-axis-line" x1="${padL}" x2="${padL}" y1="${padT}" y2="${padT + ph}"/>
                ${yLabels}
                <polyline class="pf-series" fill="none" points="${line}"/>
                ${dots}
                ${xLabels}
              </svg>
            </div>`;
};
