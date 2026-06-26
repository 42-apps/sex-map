/* ============================================================================
   World Sex Map — a globe coloured by a chosen sexuality "perspective", with a
   per-country profile and a scrubbable history-of-sexuality timeline.
   Data: data/history.js (METRICS, SEX_EVENTS, TRENDS) + data/sex-data.js.
   Engine: globe.gl (bundled). Forked from the Marriage Map.
   ========================================================================== */
'use strict';

const METRICS = window.METRICS || {};
const ORDER   = window.METRIC_ORDER || Object.keys(METRICS);
const ECATS   = window.EVENT_CATS || {};
const SLICES  = window.TIME_SLICES || [];
const EVENTS  = (window.SEX_EVENTS || []).slice().sort((a, b) => a.year - b.year);
const DATA    = window.COUNTRY_DATA || {};
const TRENDS  = window.TRENDS || {};
const TRENDMETA = window.TREND_META || {};
const EV_BY_ID = {}; EVENTS.forEach(e => (EV_BY_ID[e.id] = e));

const yr = id => parseInt(id, 10);
const STEPS = SLICES.map(s => ({ year: yr(s.id), era: s.era, label: s.label }));
const N = STEPS.length;
const curYear = () => STEPS[state.stepIdx].year;
function nearestStep(year) { let bi = 0, bd = Infinity; STEPS.forEach((s, i) => { const d = Math.abs(s.year - year); if (d < bd) { bd = d; bi = i; } }); return bi; }

const NEUTRAL = 'rgba(80, 70, 105, 0.16)';
const ERA_LABEL = { ancient: 'antiquity', classical: 'classical', medieval: 'medieval', earlymodern: 'early modern', modern: 'modern', contemporary: 'today' };
const A3_TO_A2 = { FRA: 'FR', NOR: 'NO', CYN: 'CY', SOL: 'SO' };

const state = { metric: 'sexFrequency', stepIdx: N - 1, hovered: null, selected: null, selectedEvent: null, playing: false, playDir: 1, flat: false };
let playTimer = null, spinOn = true;

/* ----------------------------- helpers ----------------------------- */
function isoOf(props) { const a2 = props.ISO_A2; if (a2 && a2 !== '-99') return a2; return A3_TO_A2[props.ADM0_A3] || null; }
const clamp01 = t => Math.max(0, Math.min(1, t));
const RAMPS = {
  gyr:   ['#2fa84f', '#e0c23a', '#c0392b'],   // green→yellow→red (low→high; high worse)
  age:   ['#c0392b', '#e0c23a', '#2fa84f'],   // red→yellow→green (low→high; low worse)
  warm:  ['#2a2620', '#c77b2e', '#ffcf6b'],
  blue:  ['#1b2c49', '#2f6fe0', '#a9d4ff'],
  teal:  ['#15302c', '#1d9e75', '#7ff0c8'],
  purple:['#241a3a', '#7b4fa3', '#cdb0f0'],
};
function rampRGB(arr, t) {
  t = clamp01(t); const seg = t * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(seg)), f = seg - i;
  const a = parseInt(arr[i].slice(1), 16), b = parseInt(arr[i + 1].slice(1), 16);
  return [Math.round((a >> 16 & 255) + ((b >> 16 & 255) - (a >> 16 & 255)) * f),
          Math.round((a >> 8 & 255) + ((b >> 8 & 255) - (a >> 8 & 255)) * f),
          Math.round((a & 255) + ((b & 255) - (a & 255)) * f)];
}
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function valOf(iso, mkey) { const m = METRICS[mkey], c = DATA[iso]; if (!m || !c) return null; const v = c[m.field]; return v == null ? null : v; }
function colorFor(mkey, v, a) {
  a = a == null ? 0.9 : a; const m = METRICS[mkey]; if (v == null || !m) return NEUTRAL;
  let rgb;
  if (m.kind === 'cat') { const cc = m.cats[v]; if (!cc) return NEUTRAL; rgb = hexToRgb(cc.color); }
  else { rgb = rampRGB(RAMPS[m.kind] || RAMPS.blue, (v - m.domain[0]) / (m.domain[1] - m.domain[0])); }
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
}
const colorSolid = (mkey, v) => colorFor(mkey, v, 1);
function fmtVal(m, v) {
  if (v == null) return '—';
  if (m.kind === 'cat') { const cc = m.cats[v]; return cc ? cc.label : v; }
  let s; if (m.fmt === 'pct0') s = Math.round(v) + '%'; else if (m.fmt === 'dec1') s = (Math.round(v * 10) / 10).toFixed(1); else s = '' + Math.round(v);
  return s + (m.fmt === 'pct0' ? '' : (m.unit || ''));
}
const nameOf = (iso, feat) => (DATA[iso] && DATA[iso].n) || (feat && (feat.properties.ADMIN || feat.properties.NAME)) || iso;
function flagEmoji(iso) { if (!iso || iso.length !== 2) return '🏳️'; return String.fromCodePoint(...[...iso.toUpperCase()].map(c => 0x1f1e6 + c.charCodeAt(0) - 65)); }
const catColor = k => (ECATS[k] && ECATS[k].color) || '#888';
const catLabel = k => (ECATS[k] && ECATS[k].label) || k;
function anchorXFrac(year) { const ys = STEPS.map(s => s.year); if (year <= ys[0]) return 0; if (year >= ys[N - 1]) return N - 1; for (let i = 0; i < N - 1; i++) if (ys[i] <= year && year <= ys[i + 1]) return i + (year - ys[i]) / (ys[i + 1] - ys[i]); return N - 1; }
function trendAt(metric, year) { const s = TRENDS[metric]; if (!s || !s.length) return null; if (year <= s[0].year) return s[0].value; if (year >= s[s.length - 1].year) return s[s.length - 1].value; for (let i = 0; i < s.length - 1; i++) if (s[i].year <= year && year <= s[i + 1].year) { const t = (year - s[i].year) / (s[i + 1].year - s[i].year); return s[i].value + (s[i + 1].value - s[i].value) * t; } return null; }

/* -------------------------------- globe -------------------------------- */
let globe, countries = [];
const elViz = document.getElementById('globeViz');
const tooltip = document.getElementById('tooltip');

function capColor(feat) {
  const iso = isoOf(feat.properties);
  const v = iso ? valOf(iso, state.metric) : null;
  const sel = state.selected && iso === state.selected, hov = state.hovered && iso === state.hovered;
  if (v == null) return (sel || hov) ? 'rgba(150,130,170,0.4)' : NEUTRAL;
  return colorFor(state.metric, v, sel ? 0.99 : hov ? 0.95 : 0.85);
}
function altOf(feat) {
  const iso = isoOf(feat.properties);
  if (state.selected && iso === state.selected) return 0.06;
  if (state.hovered && iso === state.hovered) return 0.035;
  return 0.01;
}
function initGlobe(geo) {
  countries = geo.features.filter(f => (f.properties.ADMIN || f.properties.NAME) !== 'Antarctica');
  globe = Globe()(elViz)
    .backgroundColor('rgba(0,0,0,0)')
    .showAtmosphere(true).atmosphereColor('#d98fb8').atmosphereAltitude(0.16)
    .polygonsData(countries).polygonCapColor(capColor)
    .polygonSideColor(() => 'rgba(36, 22, 50, 0.7)').polygonStrokeColor(() => 'rgba(10, 6, 18, 0.85)')
    .polygonAltitude(altOf).polygonsTransitionDuration(300)
    .onPolygonHover(onHover).onPolygonClick(onClick)
    .htmlElement(makePin).htmlLat(d => d.lat).htmlLng(d => d.lng).htmlAltitude(0.012);
  const mat = globe.globeMaterial();
  mat.color.set('#160e22'); mat.emissive.set('#0e0818'); mat.emissiveIntensity = 0.9; mat.shininess = 6;
  const c = globe.controls(); c.autoRotate = true; c.autoRotateSpeed = 0.45; c.enableDamping = true; c.dampingFactor = 0.12; c.minDistance = 108; c.maxDistance = 600;
  globe.pointOfView({ lat: 25, lng: 10, altitude: 2.4 }, 0);
  window.globe = globe;
  sizeGlobe(); requestAnimationFrame(sizeGlobe);
  if (window.ResizeObserver) new ResizeObserver(sizeGlobe).observe(elViz);
  requestAnimationFrame(() => { const cv = elViz.querySelector('canvas'); if (cv) cv.addEventListener('webglcontextlost', e => { e.preventDefault(); showGlobeError(); }); });
  refreshPins();
}
function sizeGlobe() { if (globe) globe.width(elViz.clientWidth || window.innerWidth).height(elViz.clientHeight || (window.innerHeight - 242)); }
function refreshGlobe() { if (globe) globe.polygonCapColor(capColor).polygonAltitude(altOf); }

/* event pins (history milestones near the current era) */
function makePin(d) {
  const el = document.createElement('div');
  el.title = d.title + ' · ' + fmtYear(d.year);
  el.style.cssText = 'width:14px;height:14px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);cursor:pointer;background:' + catColor(d.cat) + ';border:1.5px solid rgba(255,255,255,.6);box-shadow:0 1px 4px rgba(0,0,0,.6);transition:transform .12s';
  if (state.selectedEvent === d.id) { el.style.transform = 'rotate(-45deg) scale(1.5)'; el.style.boxShadow = '0 0 0 3px #fff, 0 1px 6px rgba(0,0,0,.7)'; }
  el.addEventListener('click', ev => { ev.stopPropagation(); selectEvent(d.id, true); });
  return el;
}
function activeBand(i) { const y = STEPS[i].year; const lo = i > 0 ? (STEPS[i - 1].year + y) / 2 : y - 200; const hi = i < N - 1 ? (STEPS[i + 1].year + y) / 2 : y + 60; return [lo, hi]; }
function refreshPins() {
  if (!globe) return;
  const [lo, hi] = activeBand(state.stepIdx);
  const act = EVENTS.filter(e => e.year >= lo && e.year <= hi);
  if (state.selectedEvent && EV_BY_ID[state.selectedEvent] && !act.includes(EV_BY_ID[state.selectedEvent])) act.push(EV_BY_ID[state.selectedEvent]);
  globe.htmlElementsData(act);
}
function showGlobeError() {
  if (document.getElementById('glLost')) return;
  const ov = document.createElement('div'); ov.id = 'glLost';
  ov.style.cssText = 'position:absolute;inset:0;z-index:6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:24px;background:rgba(12,8,20,.74)';
  ov.innerHTML = '<div style="font-size:15px;max-width:380px;line-height:1.55;color:#e8def2">The 3D globe lost its graphics context. Reload, or switch to the flat map.</div>';
  const mk = (l, fn) => { const b = document.createElement('button'); b.textContent = l; b.style.cssText = 'padding:9px 16px;border-radius:9px;cursor:pointer;font-weight:600;background:#e0568f;color:#fff;border:none;margin:0 5px'; b.onclick = fn; return b; };
  const row = document.createElement('div'); row.appendChild(mk('↻ Reload', () => location.reload())); row.appendChild(mk('🗺 Flat map', () => { ov.remove(); if (!state.flat) setFlat(true); }));
  ov.appendChild(row); elViz.appendChild(ov);
}

/* ----------------------------- hover / tooltip ----------------------------- */
function tooltipHTML(iso, feat) {
  const m = METRICS[state.metric], v = valOf(iso, state.metric);
  const head = `<div class="tt-head"><span class="tt-flag">${flagEmoji(iso)}</span><span class="tt-name">${nameOf(iso, feat)}</span></div>`;
  if (!DATA[iso]) return head + `<div class="tt-nd">No data</div>`;
  if (v == null) return head + `<div class="tt-nd">No ${m.short.toLowerCase()} data</div>`;
  return head + `<div class="tt-val"><b>${fmtVal(m, v)}</b></div><div class="tt-sub">${m.label}</div>`;
}
function onHover(feat) {
  const iso = feat ? isoOf(feat.properties) : null;
  state.hovered = iso; refreshGlobe();
  if (globe) globe.controls().autoRotate = !feat && spinOn && !state.playing;
  if (!feat) { tooltip.classList.add('hidden'); return; }
  tooltip.innerHTML = tooltipHTML(iso, feat); tooltip.classList.remove('hidden');
}
elViz.addEventListener('mousemove', e => { if (tooltip.classList.contains('hidden')) return; const r = elViz.getBoundingClientRect(); tooltip.style.left = (e.clientX - r.left) + 'px'; tooltip.style.top = (e.clientY - r.top) + 'px'; });

function featBBox(feat) { let mnx = 180, mny = 90, mxx = -180, mxy = -90; const walk = c => { if (typeof c[0] === 'number') { mnx = Math.min(mnx, c[0]); mxx = Math.max(mxx, c[0]); mny = Math.min(mny, c[1]); mxy = Math.max(mxy, c[1]); } else c.forEach(walk); }; walk(feat.geometry.coordinates); return [mnx, mny, mxx, mxy]; }
function polyCentroid(feat) { const b = featBBox(feat); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; }
function onClick(feat) {
  if (!feat) return; const iso = isoOf(feat.properties);
  state.selected = iso; state.selectedEvent = null; document.getElementById('eventCard').classList.add('hidden');
  refreshGlobe(); showDetail(iso, feat);
  const [lng, lat] = polyCentroid(feat);
  if (globe) { globe.controls().autoRotate = false; globe.pointOfView({ lat, lng, altitude: 1.8 }, 800); }
  spinOn = false; syncSpin();
}

/* ----------------------------- country detail ----------------------------- */
const detailCard = document.getElementById('detailCard');
function showDetail(iso, feat) {
  detailCard.classList.remove('hidden');
  const c = DATA[iso];
  document.getElementById('detailFlag').textContent = flagEmoji(iso);
  document.getElementById('detailName').textContent = nameOf(iso, feat);
  document.getElementById('detailSub').textContent = c ? 'Sexuality profile' : 'No data available';
  const box = document.getElementById('detailMetrics');
  if (!c) { box.innerHTML = '<div class="tt-nd" style="padding:8px 4px">No sexuality data for this country yet.</div>'; }
  else {
    box.innerHTML = ORDER.map(k => {
      const m = METRICS[k], v = c[m.field];
      if (v == null) return '';
      return `<div class="mrow${k === state.metric ? ' active' : ''}" data-m="${k}"><span class="m-sw" style="background:${colorSolid(k, v)}"></span><span class="m-l">${m.label}</span><span class="m-v">${fmtVal(m, v)}</span></div>`;
    }).join('') || '<div class="tt-nd" style="padding:8px 4px">No metrics available.</div>';
  }
  const noteEl = document.getElementById('detailNote');
  noteEl.textContent = (c && c.note) ? c.note : ''; noteEl.style.display = (c && c.note) ? '' : 'none';
}
document.getElementById('detailClose').addEventListener('click', () => { detailCard.classList.add('hidden'); state.selected = null; refreshGlobe(); if (state.flat) syncFlatSelection(); });
document.getElementById('detailMetrics').addEventListener('click', e => { const r = e.target.closest('.mrow'); if (r) setMetric(r.dataset.m); });

/* ----------------------------- perspective + legend + ranking ----------------------------- */
const sel = document.getElementById('perspective');
sel.innerHTML = ORDER.map(k => `<option value="${k}">${METRICS[k].label}</option>`).join('');
sel.addEventListener('change', () => setMetric(sel.value));
function setMetric(k) {
  if (!METRICS[k]) return;
  state.metric = k; sel.value = k;
  document.getElementById('perspDesc').textContent = METRICS[k].desc || '';
  if (state.flat) updateFlatColors(); else refreshGlobe();
  updateLegend(); updateGlobal();
  if (state.selected) { const f = countries.find(c => isoOf(c.properties) === state.selected); showDetail(state.selected, f); }
}
function updateLegend() {
  const m = METRICS[state.metric], el = document.getElementById('legend');
  if (m.kind === 'cat') {
    el.innerHTML = '<div class="cat-legend">' + Object.keys(m.cats).map(k => {
      const n = Object.keys(DATA).filter(iso => DATA[iso][m.field] === k).length;
      return `<div class="cat-row"><span class="cat-sw" style="background:${m.cats[k].color}"></span><span style="flex:1">${m.cats[k].label}</span><span style="color:var(--muted)">${n}</span></div>`;
    }).join('') + '</div>';
  } else {
    const stops = []; for (let i = 0; i <= 6; i++) { const c = rampRGB(RAMPS[m.kind] || RAMPS.blue, i / 6); stops.push(`rgb(${c[0]},${c[1]},${c[2]}) ${(i / 6 * 100).toFixed(0)}%`); }
    const lo = m.domain[0] + (m.unit || ''), hi = m.domain[1] + (m.unit || '') + (m.fmt === 'pct0' ? '' : '');
    el.innerHTML = `<div class="ramp-bar" style="background:linear-gradient(90deg,${stops.join(',')})"></div><div class="ramp-ends"><span>${fmtVal(m, m.domain[0])}</span><span>${fmtVal(m, m.domain[1])}+</span></div>`;
  }
}
function updateGlobal() {
  const m = METRICS[state.metric];
  const rows = Object.keys(DATA).map(iso => ({ iso, n: DATA[iso].n, v: DATA[iso][m.field] })).filter(r => r.v != null);
  const statEl = document.getElementById('gbStat'), lblEl = document.getElementById('gbStatLabel');
  if (m.kind === 'cat') {
    const order = Object.keys(m.cats);
    statEl.textContent = rows.length; lblEl.textContent = 'countries with data';
    rows.sort((a, b) => order.indexOf(a.v) - order.indexOf(b.v) || a.n.localeCompare(b.n));
    document.getElementById('gbRows').innerHTML = rows.map(r => `<div class="gb-row" data-iso="${r.iso}"><span class="gb-sw" style="background:${colorSolid(state.metric, r.v)}"></span><span class="gb-l">${r.n}</span><span class="gb-v" style="font-size:11px;color:var(--muted)">${m.cats[r.v].label}</span></div>`).join('');
  } else {
    const mean = rows.reduce((s, r) => s + r.v, 0) / (rows.length || 1);
    statEl.textContent = fmtVal(m, mean); lblEl.textContent = 'world average';
    rows.sort((a, b) => b.v - a.v);
    document.getElementById('gbRows').innerHTML = rows.map((r, i) => `<div class="gb-row" data-iso="${r.iso}"><span class="gb-rank">${i + 1}</span><span class="gb-l">${r.n}</span><span class="gb-v">${fmtVal(m, r.v)}</span></div>`).join('');
  }
}
document.getElementById('gbRows').addEventListener('click', e => { const r = e.target.closest('.gb-row'); if (r) gotoCountry(r.dataset.iso); });

/* ====================== history timeline ====================== */
const TLW = 1000, X0 = 14, X1 = 986, DOTY = 24, AXISY = 46;
const tlChart = document.getElementById('tlChart');
const xOfFrac = f => X0 + (f / (N - 1)) * (X1 - X0);
const fmtYear = y => y < 0 ? (-y) + ' BCE' : y <= 1500 ? y + ' CE' : '' + y;
function buildTimeline() {
  let svg = `<rect x="${X0}" y="${DOTY - 11}" width="${X1 - X0}" height="22" rx="7" fill="rgba(255,255,255,.05)"/>`;
  svg += `<line class="tl-axis" x1="${X0}" y1="${AXISY}" x2="${X1}" y2="${AXISY}"/>`;
  [0, 5, 7, 9, 11, 13, 15, N - 1].forEach(i => { if (i < 0 || i >= N) return; const x = xOfFrac(i); svg += `<text class="tl-tick" x="${x.toFixed(1)}" y="${AXISY + 13}" text-anchor="middle">${STEPS[i].label}</text>`; });
  for (const e of EVENTS) { const x = xOfFrac(anchorXFrac(e.year)); svg += `<circle class="tl-dot" data-ev="${e.id}" cx="${x.toFixed(1)}" cy="${DOTY}" r="5" fill="${catColor(e.cat)}" stroke="rgba(8,6,16,.5)" stroke-width="1"/>`; }
  svg += `<line id="tlPlay" class="tl-playhead" x1="${xOfFrac(state.stepIdx).toFixed(1)}" y1="6" x2="${xOfFrac(state.stepIdx).toFixed(1)}" y2="${AXISY + 4}"/><circle id="tlPlayGrip" class="tl-playhead-grip" cx="${xOfFrac(state.stepIdx).toFixed(1)}" cy="6" r="3.5"/>`;
  tlChart.innerHTML = svg;
  tlChart.querySelectorAll('.tl-dot').forEach(d => d.addEventListener('click', ev => { ev.stopPropagation(); selectEvent(d.dataset.ev, true); }));
  // category key
  document.getElementById('tlKey').innerHTML = Object.keys(ECATS).map(k => `<span class="tk"><span class="tk-sw" style="background:${ECATS[k].color}"></span>${ECATS[k].label}</span>`).join('');
  updateTimelineState();
}
function updateTimelineState() {
  const px = xOfFrac(state.stepIdx).toFixed(1);
  const pl = document.getElementById('tlPlay'), pg = document.getElementById('tlPlayGrip');
  if (pl) { pl.setAttribute('x1', px); pl.setAttribute('x2', px); } if (pg) pg.setAttribute('cx', px);
  const [lo, hi] = activeBand(state.stepIdx);
  tlChart.querySelectorAll('.tl-dot').forEach(d => { const e = EV_BY_ID[d.dataset.ev], active = e.year >= lo && e.year <= hi, s = state.selectedEvent === e.id; d.classList.toggle('sel', s); d.setAttribute('r', s ? 7 : active ? 6 : 4.5); d.style.opacity = s ? 1 : active ? 1 : 0.5; });
  // era readout
  const s = STEPS[state.stepIdx];
  document.getElementById('eraLabel').textContent = s.label;
  const badge = document.getElementById('eraBadge'); badge.textContent = ERA_LABEL[s.era] || s.era; badge.className = 'era-badge era-' + s.era;
  const y = curYear(); const bits = [];
  const fsx = trendAt('ageFirstSex', y); if (fsx != null) bits.push('≈ first sex at ' + fsx.toFixed(1));
  const pa = trendAt('premaritalAccept', y); if (pa != null) bits.push(Math.round(pa) + '% accept premarital sex');
  document.getElementById('eraStat').textContent = (y >= 1900 && bits.length) ? bits.join(' · ') : '';
}
function tlScrub(clientX) { const r = tlChart.getBoundingClientRect(); const vx = (clientX - r.left) / r.width * TLW; const i = Math.round((vx - X0) / (X1 - X0) * (N - 1)); gotoStep(Math.max(0, Math.min(N - 1, i))); }
let tlDragging = false;
tlChart.addEventListener('pointerdown', e => { if (e.target.classList.contains('tl-dot')) return; tlDragging = true; tlChart.setPointerCapture(e.pointerId); stopPlay(); tlScrub(e.clientX); });
tlChart.addEventListener('pointermove', e => { if (tlDragging) tlScrub(e.clientX); });
tlChart.addEventListener('pointerup', () => { tlDragging = false; });

/* event card */
const eventCard = document.getElementById('eventCard');
function selectEvent(id, fly) {
  const e = EV_BY_ID[id]; if (!e) return;
  state.selectedEvent = id; state.selected = null; detailCard.classList.add('hidden');
  gotoStep(nearestStep(e.year), true);
  document.getElementById('evCatDot').style.background = catColor(e.cat);
  document.getElementById('evCat').textContent = catLabel(e.cat);
  document.getElementById('evTitle').textContent = e.title;
  document.getElementById('evMeta').textContent = fmtYear(e.year) + ' · ' + e.place;
  document.getElementById('evBlurb').textContent = e.blurb || '';
  const sw = document.getElementById('evSrcWrap');
  if (e.src && e.src.length) { sw.classList.remove('hidden'); document.getElementById('evSrc').innerHTML = e.src.map(s => `<span class="ev-tag">${s}</span>`).join(''); } else sw.classList.add('hidden');
  eventCard.classList.remove('hidden');
  refreshPins(); updateTimelineState();
  if (fly && globe && !state.flat) { globe.controls().autoRotate = false; globe.pointOfView({ lat: e.lat, lng: e.lng, altitude: 1.7 }, 850); spinOn = false; syncSpin(); }
  if (fly && state.flat) flyFlatTo(e.lng, e.lat);
}
document.getElementById('eventClose').addEventListener('click', () => { eventCard.classList.add('hidden'); state.selectedEvent = null; refreshPins(); updateTimelineState(); });

/* ------------------------------ time stepping ------------------------------ */
const slider = document.getElementById('timeSlider');
function applyStep(skipPins) {
  slider.value = state.stepIdx;
  if (!skipPins) refreshPins();
  updateTimelineState();
}
function gotoStep(i, skipPins) { state.stepIdx = i; stopPlay(); applyStep(skipPins); }
slider.min = 0; slider.max = N - 1; slider.step = 1;
slider.addEventListener('input', () => { state.stepIdx = +slider.value; stopPlay(); applyStep(); });
document.getElementById('prevEra').addEventListener('click', () => gotoStep(Math.max(0, state.stepIdx - 1)));
document.getElementById('nextEra').addEventListener('click', () => gotoStep(Math.min(N - 1, state.stepIdx + 1)));
document.getElementById('nowBtn').addEventListener('click', () => gotoStep(N - 1));
const playBtn = document.getElementById('playBtn'), playRevBtn = document.getElementById('playRevBtn');
function syncPlayBtns() { const f = state.playing && state.playDir > 0, r = state.playing && state.playDir < 0; playBtn.textContent = f ? '⏸' : '▶'; playBtn.classList.toggle('on', f); playRevBtn.textContent = r ? '⏸' : '◀'; playRevBtn.classList.toggle('on', r); }
function stopPlay() { state.playing = false; if (playTimer) { clearInterval(playTimer); playTimer = null; } syncPlayBtns(); if (globe) globe.controls().autoRotate = spinOn && !state.flat; }
function startPlay(dir) { state.playDir = dir; if (dir > 0 && state.stepIdx >= N - 1) state.stepIdx = 0; if (dir < 0 && state.stepIdx <= 0) state.stepIdx = N - 1; state.playing = true; syncPlayBtns(); if (globe) globe.controls().autoRotate = false; applyStep(); playTimer = setInterval(() => { const nx = state.stepIdx + state.playDir; if (nx < 0 || nx >= N) { stopPlay(); return; } state.stepIdx = nx; applyStep(); }, 950); }
playBtn.addEventListener('click', () => { if (state.playing && state.playDir > 0) stopPlay(); else { stopPlay(); startPlay(1); } });
playRevBtn.addEventListener('click', () => { if (state.playing && state.playDir < 0) stopPlay(); else { stopPlay(); startPlay(-1); } });

/* ============================ flat map ============================ */
const FW = 2000, FH = 1000;
const fpx = lng => (lng + 180) / 360 * FW, fpy = lat => (90 - lat) / 180 * FH;
const geomOf = f => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates);
function flatPathD(f) { let d = ''; for (const poly of geomOf(f)) for (const ring of poly) d += 'M' + ring.map(p => fpx(p[0]).toFixed(1) + ',' + fpy(p[1]).toFixed(1)).join('L') + 'Z'; return d; }
let flatBuilt = false; const flatMeta = {};
function buildFlatMap() {
  if (flatBuilt) return; const svg = document.getElementById('flatViz'); svg.setAttribute('viewBox', '0 0 ' + FW + ' ' + FH);
  let cells = '', hits = '';
  for (const f of countries) { const iso = isoOf(f.properties); if (!iso || flatMeta[iso]) continue; const d = flatPathD(f), b = featBBox(f); flatMeta[iso] = { cx: fpx((b[0] + b[2]) / 2), cy: fpy((b[1] + b[3]) / 2) }; cells += `<path class="flat-cell" data-iso="${iso}" d="${d}"/>`; hits += `<path class="flat-hit" data-iso="${iso}" d="${d}"/>`; }
  svg.innerHTML = `<rect class="flat-ocean" width="${FW}" height="${FH}"/><g id="flatCells">${cells}</g><g id="flatPins"></g><g id="flatHits">${hits}</g>`;
  svg.querySelectorAll('.flat-hit').forEach(el => { const iso = el.dataset.iso; el.addEventListener('mousemove', e => flatHover(iso, e)); el.addEventListener('mouseleave', () => { state.hovered = null; tooltip.classList.add('hidden'); }); el.addEventListener('click', () => { if (flatPanned) return; state.selected = iso; state.selectedEvent = null; eventCard.classList.add('hidden'); showDetail(iso, countries.find(c => isoOf(c.properties) === iso)); syncFlatSelection(); }); });
  initFlatInteract(); flatBuilt = true;
}
function updateFlatColors() { if (!flatBuilt) return; for (const iso in flatMeta) { const el = document.querySelector('.flat-cell[data-iso="' + iso + '"]'); if (!el) continue; const v = valOf(iso, state.metric); el.setAttribute('fill', v == null ? NEUTRAL : colorFor(state.metric, v, 0.92)); } syncFlatSelection(); }
function updateFlatPins() {
  if (!flatBuilt) return; const [lo, hi] = activeBand(state.stepIdx); const pinG = document.getElementById('flatPins');
  pinG.innerHTML = EVENTS.filter(e => e.year >= lo && e.year <= hi).map(e => `<g class="flat-pin" data-ev="${e.id}"><circle cx="${fpx(e.lng).toFixed(0)}" cy="${fpy(e.lat).toFixed(0)}" r="7" fill="${catColor(e.cat)}" stroke="rgba(255,255,255,.6)" stroke-width="1.4"/></g>`).join('');
  pinG.querySelectorAll('.flat-pin').forEach(g => g.addEventListener('click', ev => { ev.stopPropagation(); selectEvent(g.dataset.ev, true); }));
}
function syncFlatSelection() { if (flatBuilt) document.querySelectorAll('.flat-hit').forEach(el => el.classList.toggle('sel', el.dataset.iso === state.selected)); }
function flatHover(iso, e) { if (flatDragging) return; state.hovered = iso; tooltip.innerHTML = tooltipHTML(iso, countries.find(c => isoOf(c.properties) === iso)); tooltip.classList.remove('hidden'); tooltip.style.left = e.clientX + 'px'; tooltip.style.top = e.clientY + 'px'; }
const flatView = { x: 0, y: 0, w: FW, h: FH }; let flatDragging = false, flatPanned = false;
function applyFlatView() { const svg = document.getElementById('flatViz'); if (svg) svg.setAttribute('viewBox', flatView.x.toFixed(1) + ' ' + flatView.y.toFixed(1) + ' ' + flatView.w.toFixed(1) + ' ' + flatView.h.toFixed(1)); }
function clampFlatView() { flatView.w = Math.max(FW / 16, Math.min(FW, flatView.w)); flatView.h = flatView.w * (FH / FW); flatView.x = Math.max(0, Math.min(FW - flatView.w, flatView.x)); flatView.y = Math.max(0, Math.min(FH - flatView.h, flatView.y)); }
function resetFlatView() { flatView.x = 0; flatView.y = 0; flatView.w = FW; flatView.h = FH; applyFlatView(); }
function flyFlatTo(lng, lat) { flatView.w = FW / 4; flatView.h = flatView.w * (FH / FW); flatView.x = fpx(lng) - flatView.w / 2; flatView.y = fpy(lat) - flatView.h / 2; clampFlatView(); applyFlatView(); }
function flatClientToSvg(cx, cy) { const svg = document.getElementById('flatViz'), r = svg.getBoundingClientRect(); const sc = Math.min(r.width / flatView.w, r.height / flatView.h); return { x: flatView.x + (cx - r.left - (r.width - flatView.w * sc) / 2) / sc, y: flatView.y + (cy - r.top - (r.height - flatView.h * sc) / 2) / sc }; }
let flatBound = false;
function initFlatInteract() {
  if (flatBound) return; const svg = document.getElementById('flatViz');
  svg.addEventListener('wheel', e => { e.preventDefault(); const p = flatClientToSvg(e.clientX, e.clientY); const nw = Math.max(FW / 16, Math.min(FW, flatView.w * (e.deltaY < 0 ? 0.84 : 1 / 0.84))), k = nw / flatView.w; flatView.x = p.x - (p.x - flatView.x) * k; flatView.y = p.y - (p.y - flatView.y) * k; flatView.w = nw; clampFlatView(); applyFlatView(); }, { passive: false });
  svg.addEventListener('mousedown', e => { flatDragging = true; flatPanned = false; svg.style.cursor = 'grabbing'; tooltip.classList.add('hidden'); const r = svg.getBoundingClientRect(), sc = Math.min(r.width / flatView.w, r.height / flatView.h); const sx = e.clientX, sy = e.clientY, ox = flatView.x, oy = flatView.y; const move = ev => { if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) flatPanned = true; flatView.x = ox - (ev.clientX - sx) / sc; flatView.y = oy - (ev.clientY - sy) / sc; clampFlatView(); applyFlatView(); }; const up = () => { flatDragging = false; svg.style.cursor = ''; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); setTimeout(() => { flatPanned = false; }, 30); }; window.addEventListener('mousemove', move); window.addEventListener('mouseup', up); });
  flatBound = true;
}

/* ------------------------------ menu / view ------------------------------ */
const menu = document.getElementById('menu'), menuBtn = document.getElementById('menuBtn');
const closeMenu = () => menu.classList.add('hidden');
menuBtn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('hidden'); });
document.addEventListener('click', e => { if (!menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== menuBtn) closeMenu(); });
function setFlat(flat) {
  state.flat = flat;
  document.getElementById('flatViz').classList.toggle('hidden', !flat); elViz.classList.toggle('hidden', flat);
  const mv = document.getElementById('miView'); mv.querySelector('.mi-ic').textContent = flat ? '🌐' : '🗺'; mv.querySelector('.mi-tx').textContent = flat ? 'Globe view' : 'Flat map';
  document.querySelectorAll('.mi-globe').forEach(el => el.classList.toggle('hidden', flat));
  if (flat) { buildFlatMap(); updateFlatColors(); updateFlatPins(); try { if (!localStorage.getItem('sx_seen_flat') && document.getElementById('tutorial').classList.contains('hidden')) showFlatTip(); } catch (e) {} }
  else { refreshGlobe(); refreshPins(); if (globe) globe.controls().autoRotate = spinOn && !state.playing; }
}
document.getElementById('miView').addEventListener('click', () => { setFlat(!state.flat); closeMenu(); });
const miSpin = document.getElementById('miSpin');
function syncSpin() { const s = miSpin.querySelector('.mi-state'); if (s) s.textContent = spinOn ? 'On' : 'Off'; miSpin.classList.toggle('on', spinOn); }
miSpin.addEventListener('click', () => { spinOn = !spinOn; if (globe && !state.playing) globe.controls().autoRotate = spinOn; syncSpin(); }); syncSpin();
document.getElementById('miReset').addEventListener('click', () => { closeAll(); if (state.flat) resetFlatView(); if (globe) globe.pointOfView({ lat: 25, lng: 10, altitude: 2.4 }, 700); closeMenu(); });
document.getElementById('miFull').addEventListener('click', () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); closeMenu(); });
document.getElementById('miHelp').addEventListener('click', () => { closeMenu(); if (state.flat) showFlatTip(); else showTutorial(); });
const aboutOverlay = document.getElementById('aboutOverlay');
document.getElementById('miAbout').addEventListener('click', () => { closeMenu(); aboutOverlay.classList.remove('hidden'); });
document.getElementById('aboutClose').addEventListener('click', () => aboutOverlay.classList.add('hidden'));
aboutOverlay.addEventListener('click', e => { if (e.target === aboutOverlay) aboutOverlay.classList.add('hidden'); });
function closeAll() { detailCard.classList.add('hidden'); eventCard.classList.add('hidden'); state.selected = null; state.selectedEvent = null; refreshGlobe(); refreshPins(); updateTimelineState(); }

/* tutorial / tips */
function showTutorial() { document.getElementById('tutorial').classList.remove('hidden'); }
function closeTutorial() { const t = document.getElementById('tutorial'); if (t.classList.contains('hidden')) return; t.classList.add('hidden'); try { localStorage.setItem('sx_seen_tutorial', '1'); } catch (e) {} }
document.getElementById('tutStart').addEventListener('click', closeTutorial);
document.getElementById('tutorial').addEventListener('click', e => { if (e.target.id === 'tutorial') closeTutorial(); });
function showFlatTip() { document.getElementById('flatTip').classList.remove('hidden'); }
function closeFlatTip() { const t = document.getElementById('flatTip'); if (t.classList.contains('hidden')) return; t.classList.add('hidden'); try { localStorage.setItem('sx_seen_flat', '1'); } catch (e) {} }
document.getElementById('ftStart').addEventListener('click', closeFlatTip);
document.getElementById('flatTip').addEventListener('click', e => { if (e.target.id === 'flatTip') closeFlatTip(); });

/* search + share */
function gotoCountry(iso) {
  const f = countries.find(c => isoOf(c.properties) === iso); state.selectedEvent = null; eventCard.classList.add('hidden');
  if (!f) { state.selected = iso; refreshGlobe(); showDetail(iso, null); return; }
  if (state.flat) { state.selected = iso; showDetail(iso, f); syncFlatSelection(); const [lng, lat] = polyCentroid(f); flyFlatTo(lng, lat); } else onClick(f);
}
const searchEl = document.getElementById('search'), searchRes = document.getElementById('searchResults'); let searchHits = [];
function runSearch() { const q = searchEl.value.trim().toLowerCase(); if (!q) { searchRes.classList.add('hidden'); searchHits = []; return; } searchHits = Object.keys(DATA).map(iso => ({ iso, n: DATA[iso].n })).filter(c => c.n.toLowerCase().includes(q)).sort((a, b) => a.n.toLowerCase().indexOf(q) - b.n.toLowerCase().indexOf(q) || a.n.localeCompare(b.n)).slice(0, 8); if (!searchHits.length) { searchRes.innerHTML = '<div class="sr-none">No match</div>'; searchRes.classList.remove('hidden'); return; } searchRes.innerHTML = searchHits.map((c, i) => `<div class="sr-item${i === 0 ? ' sel' : ''}" data-iso="${c.iso}"><span class="sr-flag">${flagEmoji(c.iso)}</span>${c.n}</div>`).join(''); searchRes.classList.remove('hidden'); }
function pickSearch(iso) { if (!iso && searchHits.length) iso = searchHits[0].iso; if (!iso) return; gotoCountry(iso); searchEl.value = ''; searchRes.classList.add('hidden'); searchHits = []; searchEl.blur(); }
searchEl.addEventListener('input', runSearch);
searchEl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); pickSearch(); } else if (e.key === 'Escape') { searchEl.value = ''; searchRes.classList.add('hidden'); searchEl.blur(); } });
searchRes.addEventListener('click', e => { const it = e.target.closest('.sr-item'); if (it) pickSearch(it.dataset.iso); });
document.addEventListener('click', e => { if (!document.getElementById('searchWrap').contains(e.target)) searchRes.classList.add('hidden'); });
let toastTimer = null;
function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.remove('hidden'); if (toastTimer) clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2400); }
function buildShareURL() { const seg = [state.metric, state.selected || '', state.selectedEvent || '']; if (state.flat) seg.push('flat'); while (seg.length > 1 && seg[seg.length - 1] === '') seg.pop(); return location.origin + location.pathname + '#' + seg.join(','); }
function fallbackCopy(t, cb) { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); cb(); } catch (e) {} document.body.removeChild(ta); }
document.getElementById('miShare').addEventListener('click', () => { closeMenu(); const url = buildShareURL(), done = () => showToast('🔗 Link to this view copied'); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done)); else fallbackCopy(url, done); });

/* global trends overlay */
function trendsSVG() {
  const W = 760, H = 320, padT = 12, padB = 30, padL = 6, padR = 6;
  const years = [1900, 1950, 1970, 1990, 2000, 2010, 2020, 2024];
  const xAt = y => padL + (y - 1900) / (2024 - 1900) * (W - padL - padR);
  let body = '', labs = '';
  years.forEach(y => { const x = xAt(y); labs += `<line x1="${x.toFixed(0)}" y1="${padT}" x2="${x.toFixed(0)}" y2="${H - padB}" stroke="rgba(255,255,255,.06)"/><text x="${x.toFixed(0)}" y="${H - 9}" font-size="11" fill="#9b8ab0" text-anchor="middle">${y}</text>`; });
  for (const key in TRENDS) {
    const s = TRENDS[key], mx = Math.max(...s.map(p => p.value)), mn = Math.min(...s.map(p => p.value)), rng = (mx - mn) || 1;
    const yAt = v => padT + (1 - (v - mn) / rng) * (H - padT - padB);
    const col = (TRENDMETA[key] || {}).color || '#fff';
    let d = ''; s.forEach((p, i) => { d += (i ? 'L' : 'M') + xAt(p.year).toFixed(1) + ',' + yAt(p.value).toFixed(1); });
    body += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.4"/>`;
    s.forEach(p => { body += `<circle cx="${xAt(p.year).toFixed(1)}" cy="${yAt(p.value).toFixed(1)}" r="2.6" fill="${col}"/>`; });
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="wt-svg">${labs}${body}</svg>`;
}
function showTrends() {
  document.getElementById('wtChart').innerHTML = trendsSVG();
  document.getElementById('wtLegend').innerHTML = Object.keys(TRENDS).map(k => { const m = TRENDMETA[k] || {}; return `<span class="wt-li"><span class="wt-sw" style="background:${m.color || '#fff'}"></span>${m.label || k}</span>`; }).join('');
  document.getElementById('trendOverlay').classList.remove('hidden');
}
document.getElementById('miTrend').addEventListener('click', () => { closeMenu(); showTrends(); });
document.getElementById('trendClose').addEventListener('click', () => document.getElementById('trendOverlay').classList.add('hidden'));
document.getElementById('trendOverlay').addEventListener('click', e => { if (e.target.id === 'trendOverlay') document.getElementById('trendOverlay').classList.add('hidden'); });

/* keyboard + resize */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeMenu(); closeTutorial(); closeFlatTip(); aboutOverlay.classList.add('hidden'); document.getElementById('trendOverlay').classList.add('hidden'); if (!eventCard.classList.contains('hidden') || !detailCard.classList.contains('hidden')) closeAll(); }
  else if (e.target && e.target.tagName === 'INPUT') return;
  else if (e.key === 'ArrowRight') gotoStep(Math.min(N - 1, state.stepIdx + 1));
  else if (e.key === 'ArrowLeft') gotoStep(Math.max(0, state.stepIdx - 1));
});
window.addEventListener('resize', sizeGlobe);

/* boot */
function boot() {
  const parts = decodeURIComponent((location.hash || '').slice(1)).split(',').map(s => s.trim());
  if (parts[0] && METRICS[parts[0]]) state.metric = parts[0];
  setMetric(state.metric);
  buildTimeline(); applyStep();
  try { if (!localStorage.getItem('sx_seen_tutorial')) showTutorial(); } catch (e) {}
  fetch('data/countries.geojson').then(r => r.json()).then(geo => {
    initGlobe(geo); refreshGlobe();
    if (/(^|,)flat($|,)/i.test(location.hash)) setFlat(true);
    if (parts[1]) { const f = countries.find(c => isoOf(c.properties) === parts[1].toUpperCase()); if (f) gotoCountry(parts[1].toUpperCase()); }
    if (parts[2] && EV_BY_ID[parts[2]]) selectEvent(parts[2], true);
  }).catch(err => { console.error('geojson load failed', err); elViz.innerHTML = '<div style="color:#b09ec0;text-align:center;padding-top:35vh">Could not load map data.</div>'; });
}
document.addEventListener('DOMContentLoaded', boot);
