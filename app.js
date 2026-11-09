/* All Star Automotive preview · "What's due" mileage planner. Typical intervals only; no prices. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = s => document.querySelector(s);
  const fmt = n => Math.round(n).toLocaleString('en-US');

  // every = miles between services; age(years) = time-based status. Bay times are typical, not quotes.
  const ITEMS = [
    { id: 'oil', name: 'Oil and filter change', every: 5000, bay: 'about 30 min', why: 'Old oil thins out and stops protecting the engine.' },
    { id: 'rotate', name: 'Tire rotation', every: 7500, bay: 'about 30 min', why: 'Front tires wear faster. Swapping them evens it out so the set lasts.' },
    { id: 'air', name: 'Engine air filter', every: 30000, bay: 'about 15 min', why: 'A clogged filter chokes the engine and costs you gas.' },
    { id: 'pads', name: 'Brake pads and rotors check', every: 40000, bay: 'about 1–2 hrs if replaced', why: 'Thin pads grind into the rotors, and stopping takes longer.' },
    { id: 'tires', name: 'New tires and alignment', every: 50000, bay: 'about 1 hr', why: 'Worn tread is the first thing to go in the rain.' },
    { id: 'trans', name: 'Transmission fluid', every: 60000, bay: 'about 1 hr', why: 'Fresh fluid keeps shifts smooth. Old fluid cooks the clutches.' },
    { id: 'coolant', name: 'Coolant flush', every: 60000, bay: 'about 1 hr', why: 'Old coolant turns acidic and eats the radiator and water pump.' },
    { id: 'belt', name: 'Drive belt and hoses', every: 60000, oldAge: 10, bay: 'about 1 hr', why: 'When this belt snaps, the alternator and AC stop with it.' },
    { id: 'shocks', name: 'Shocks and struts', every: 80000, bay: 'about 2–3 hrs', why: 'Worn struts mean nose-dive braking and a bouncy ride.' },
    { id: 'timing', name: 'Timing belt (if your engine has one)', every: 90000, bay: 'about 3–5 hrs', why: 'If it breaks, the engine can wreck itself. Many engines use a chain instead: ask.' },
    { id: 'plugs', name: 'Spark plugs', every: 100000, bay: 'about 1–2 hrs', why: 'Worn plugs mean a rough idle, misfires and worse mileage.' },
    { id: 'battery', name: 'Battery test', ageSoon: 3, ageNow: 6, bay: 'about 20 min', why: 'Most batteries quit around year 4 or 5, usually on the first cold morning.' },
    { id: 'bfluid', name: 'Brake fluid', ageSoon: 3, ageNow: 99, bay: 'about 45 min', why: 'Brake fluid soaks up water over the years and the pedal goes soft.' }
  ];

  function status(it, miles, age) {
    if (it.every) {
      if (miles < 1000) return { s: 'later', at: it.every };
      const pos = miles % it.every, next = miles - pos + it.every;
      if (miles >= it.every && pos <= it.every * 0.03) return { s: 'now', at: miles - pos };
      const r = (next - miles) / it.every;
      let s = r <= 0.1 ? 'now' : r <= 0.3 ? 'soon' : 'later';
      if (it.oldAge && age >= it.oldAge && s === 'later') s = 'soon';
      return { s, at: next };
    }
    return { s: age >= it.ageNow ? 'now' : age >= it.ageSoon ? 'soon' : 'later', time: true };
  }

  // ---------- odometer ----------
  const odo = $('#odo');
  if (!odo) return;
  const reels = [...odo.querySelectorAll('.reel')];
  reels.forEach(r => { r.innerHTML = Array.from({ length: 11 }, (_, i) => `<span aria-hidden="true">${i % 10}</span>`).join(''); });
  let drumH = 0;
  const measure = () => { drumH = reels[0].parentElement.getBoundingClientRect().height; };
  measure();
  addEventListener('resize', () => { measure(); paint(shown); }, { passive: true });

  // Real odometer carry: a wheel turns only while the wheel to its right goes 9 -> 0.
  function paint(v) {
    v = Math.max(0, Math.min(999999, v));
    for (let i = 0; i < 6; i++) {
      const p = 10 ** (5 - i);
      let pos;
      if (p === 1) pos = v % 10;
      else {
        const base = Math.floor(v / p) % 10, rem = v % p, edge = p - 1;
        pos = base + (rem > edge ? rem - edge : 0);
      }
      reels[i].style.transform = `translate3d(0,${-pos * drumH}px,0)`;
    }
  }

  // ---------- list ----------
  const lists = { now: $('#list-now'), soon: $('#list-soon'), later: $('#list-later') };
  const nodes = {}, where = {}, picked = {};
  ITEMS.forEach(it => {
    const li = document.createElement('li');
    li.className = 'item';
    nodes[it.id] = li;
  });
  function fill(li, it, st, group) {
    if (group === 'later') {
      li.innerHTML = `<b></b><span></span>`;
      li.children[0].textContent = it.name;
      li.children[1].textContent = st.time ? 'by age' : `around ${fmt(st.at)}`;
      return;
    }
    li.innerHTML = `<label><input type="checkbox"><span class="it-name"></span><span class="it-bay"></span><span class="it-why"></span><span class="it-at"></span></label>`;
    const cb = li.querySelector('input');
    cb.checked = it.id in picked ? picked[it.id] : group === 'now';
    cb.addEventListener('change', () => { picked[it.id] = cb.checked; count(); });
    li.querySelector('.it-name').textContent = it.name;
    li.querySelector('.it-bay').textContent = it.bay;
    li.querySelector('.it-why').textContent = it.why;
    li.querySelector('.it-at').textContent = st.time ? (it.id === 'battery' ? 'By age, not miles' : 'Every 3 years or so, by age') : `Typically due around ${fmt(st.at)} mi`;
  }
  let age = 4, lastKey = '';
  function update(miles, animate) {
    let k = 0;
    const key = Math.round(miles) + '|' + age;
    if (key === lastKey) return;
    lastKey = key;
    ITEMS.forEach(it => {
      const st = status(it, miles, age), g = st.s, li = nodes[it.id];
      const atKey = g + (st.at || '');
      if (where[it.id] !== atKey) {
        const moved = !where[it.id] || where[it.id][0] !== g[0];
        fill(li, it, st, g);
        lists[g].appendChild(li);
        if (moved && animate && !reduce) { li.classList.remove('pop'); void li.offsetWidth; li.style.animationDelay = (k++ * 55) + 'ms'; li.classList.add('pop'); }
        where[it.id] = atKey;
      }
    });
    // keep a stable order inside each group
    Object.values(lists).forEach(ul => ITEMS.forEach(it => { if (nodes[it.id].parentElement === ul) ul.appendChild(nodes[it.id]); }));
    $('#at-miles').textContent = fmt(miles);
    $('#n-now').textContent = lists.now.children.length;
    $('#n-soon').textContent = lists.soon.children.length;
    count();
  }
  function ticked() {
    return [...document.querySelectorAll('#list-now .item, #list-soon .item')].filter(li => li.querySelector('input')?.checked).map(li => li.querySelector('.it-name').textContent);
  }
  function count() { $('#ask-count').textContent = `(${ticked().length})`; }

  // ---------- motion: ease the shown value toward the target ----------
  let shown = 0, target = 60000, raf = 0, from = 0, t0 = 0, dur = 0;
  const ease = t => 1 - Math.pow(1 - t, 3);
  function go(v, ms) {
    target = Math.max(0, Math.min(999999, Math.round(v)));
    odo.setAttribute('aria-label', `Odometer reading ${fmt(target)} miles`);
    if (reduce || ms === 0) { shown = target; paint(shown); update(shown, false); return; }
    from = shown; t0 = performance.now(); dur = ms;
    if (!raf) raf = requestAnimationFrame(step);
  }
  function step(now) {
    const t = Math.min(1, (now - t0) / dur);
    shown = from + (target - from) * ease(t);
    paint(shown);
    if (dur <= 300) update(Math.round(shown / 100) * 100, true);
    if (t < 1) raf = requestAnimationFrame(step);
    else { raf = 0; shown = target; paint(shown); update(shown, true); }
  }

  // ---------- controls ----------
  const slider = $('#miles'), typed = $('#miles-typed');
  const setSliderText = v => slider.setAttribute('aria-valuetext', `${fmt(v)} miles`);
  slider.addEventListener('input', () => { const v = +slider.value; setSliderText(v); typed.value = ''; go(v, 260); });
  document.querySelectorAll('[data-miles]').forEach(b => b.addEventListener('click', () => {
    const v = +b.dataset.miles; slider.value = v; setSliderText(v); typed.value = ''; go(v, 700);
  }));
  typed.addEventListener('input', () => {
    const v = parseInt(typed.value, 10);
    if (Number.isNaN(v)) return;
    slider.value = Math.min(200000, v); setSliderText(v); go(v, 500);
  });
  document.querySelectorAll('[data-age]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-age]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    age = +b.dataset.age; lastKey = ''; update(Math.round(shown), true);
  }));
  // arrow keys inside the age radiogroup
  $('.seg').addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const bs = [...document.querySelectorAll('[data-age]')], i = bs.indexOf(document.activeElement);
    const n = bs[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length];
    e.preventDefault(); n.focus(); n.click();
  });

  // year select: picking a year also sets the age row
  const yearSel = $('#car-year'), thisYear = new Date().getFullYear();
  for (let y = thisYear + 1; y >= 1985; y--) yearSel.add(new Option(y, y));
  yearSel.addEventListener('change', () => {
    if (!yearSel.value) return;
    const a = thisYear - +yearSel.value, pick = a <= 2 ? 1 : a <= 5 ? 4 : a <= 9 ? 7 : 12;
    document.querySelector(`[data-age="${pick}"]`).click();
  });

  // hand-off to the quote form (built lower on the page)
  $('#ask').addEventListener('click', e => {
    const form = $('#quote-form');
    if (!form) return;
    e.preventDefault();
    const f = form.elements, items = ticked();
    f.year.value = yearSel.value; f.make.value = $('#car-make').value.trim(); f.model.value = $('#car-model').value.trim();
    f.mileage.value = Math.round(target);
    f.service.value = 'Scheduled maintenance';
    f.problem.value = items.length ? `At ${fmt(target)} miles, please quote: ${items.join(', ')}.` : `At ${fmt(target)} miles. What's due?`;
    $('#quote').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    setTimeout(() => f.name.focus({ preventScroll: true }), reduce ? 0 : 600);
  });

  // ---------- first roll ----------
  paint(0); update(0, false);
  if (reduce) go(60000, 0);
  else setTimeout(() => go(60000, 1900), 350);
})();

/* today's row in the hours (New York time) */
(() => {
  try {
    const d = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
    const i = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(d);
    const row = document.querySelector(`#hours [data-day="${i}"]`);
    if (row) row.classList.add('today');
  } catch (e) {}
})();

/* service cards prefill the quote form */
document.querySelectorAll('[data-service]').forEach(b => b.addEventListener('click', () => {
  const f = document.querySelector('#quote-form');
  if (!f) return;
  f.elements.service.value = b.dataset.service;
  document.querySelector('#quote').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  setTimeout(() => f.elements.name.focus({ preventScroll: true }), 600);
}));

/* quote form (front end only) */
(() => {
  const form = document.querySelector('#quote-form');
  if (!form) return;
  form.querySelectorAll('[required]').forEach(i => i.addEventListener('input', () => i.removeAttribute('aria-invalid')));
  form.addEventListener('submit', e => {
    form.querySelectorAll('[required]').forEach(i => { if (!i.value.trim()) i.setAttribute('aria-invalid', 'true'); });
  }, true);
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const v = new FormData(form), out = document.querySelector('#confirmation');
    const car = ['year', 'make', 'model'].map(k => String(v.get(k) || '').trim()).filter(Boolean).join(' ');
    const miles = v.get('mileage') ? `${(+v.get('mileage')).toLocaleString('en-US')} miles` : '';
    out.replaceChildren();
    const h = document.createElement('strong'); h.textContent = 'Your quote request';
    const p = document.createElement('p');
    p.textContent = `${v.get('service') || 'Service to discuss'}${car ? ' for a ' + car : ''}${miles ? ', ' + miles : ''}, for ${String(v.get('name')).trim()} at ${v.get('phone')}.${v.get('time') ? ' Best time to call: ' + v.get('time') + '.' : ''}`;
    out.append(h, p);
    if (String(v.get('problem') || '').trim()) { const q = document.createElement('p'); q.textContent = v.get('problem'); out.append(q); }
    const n = document.createElement('p'); n.className = 'note'; n.textContent = 'Preview only: nothing was sent. On the real site, the shop confirms by text or call.';
    out.append(n);
    form.querySelectorAll('[aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));
    out.hidden = false; out.focus();
  });
})();

/* reveal on scroll (house standard) */
(() => {
  const els = [...document.querySelectorAll('[data-reveal]')];
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('is-visible')); return; }
  const n = new Map();
  els.forEach(e => { const p = e.parentElement, i = n.get(p) || 0; e.style.setProperty('--d', i * .08 + 's'); n.set(p, i + 1); });
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } }), { threshold: .01, rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
  setTimeout(() => els.forEach(e => { if (e.getBoundingClientRect().top < innerHeight) e.classList.add('is-visible'); }), 1500);
})();

/* logo goes all the way to the top */
document.querySelector('.logo')?.addEventListener('click', e => {
  e.preventDefault();
  scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});
