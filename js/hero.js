/* =========================================================
   BMW M Finder — scroll-scrubbed video hero
   The video is pre-extracted to an image sequence (frames/d = desktop,
   frames/m = mobile) and painted to a canvas, so every scroll position
   maps to an exact frame. Lenis gives the smooth scroll.
   ========================================================= */
(() => {
  const FRAME_COUNT = 612;
  const isMobile = matchMedia("(max-width: 767px)").matches;
  const DIR = isMobile ? "frames/m/" : "frames/d/";
  const src = i => DIR + String(i + 1).padStart(4, "0") + ".jpg";

  const $ = s => document.querySelector(s);
  const hero = $("#hero"), stage = $("#stage"), canvas = $("#canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const scenes = [...document.querySelectorAll(".scene")].map(el => ({
    el,
    from: +el.dataset.from,
    to: +el.dataset.to,
    holdStart: el.hasAttribute("data-hold-start"),
    holdEnd: el.hasAttribute("data-hold-end"),
    counters: [...el.querySelectorAll("[data-count]")],
  }));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.body.classList.add("is-loading");

  /* ---------- 1. Progressive frame loading ---------- */
  const frames = new Array(FRAME_COUNT);
  const loaded = new Uint8Array(FRAME_COUNT);
  const order = [];
  // coarse frames first (every 16th, then 8th, 4th, 2nd, all) so scrubbing works early
  for (const step of [16, 8, 4, 2, 1])
    for (let i = 0; i < FRAME_COUNT; i += step) if (!order.includes(i)) order.push(i);
  order.push(FRAME_COUNT - 1);

  const FIRST_BATCH = Math.ceil(FRAME_COUNT / 8) + 1; // every 8th frame is enough to start
  let done = 0, revealed = false;
  const pctEl = $("#loadPct"), barEl = $("#loadBar");

  function loadFrame(i) {
    return new Promise(res => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => { frames[i] = img; loaded[i] = 1; res(); };
      img.onerror = () => res();
      img.src = src(i);
    });
  }
  async function loadAll() {
    const queue = [...new Set(order)];
    const workers = Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const i = queue.shift();
        await loadFrame(i);
        done++;
        if (!revealed) {
          const pct = Math.min(100, Math.round((done / FIRST_BATCH) * 100));
          pctEl.textContent = pct;
          barEl.style.transform = `scaleX(${pct / 100})`;
          if (i === 0) requestDraw(true);
          if (done >= FIRST_BATCH) reveal();
        }
      }
    });
    await Promise.all(workers);
    reveal();
  }
  function nearestLoaded(i) {
    if (loaded[i]) return i;
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (i - d >= 0 && loaded[i - d]) return i - d;
      if (i + d < FRAME_COUNT && loaded[i + d]) return i + d;
    }
    return -1;
  }

  /* ---------- 2. Canvas (cover-fit, DPR aware) ---------- */
  let cw = 0, ch = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = stage.clientWidth; ch = stage.clientHeight;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = "high";
    requestDraw(true);
  }
  let drawn = -1;
  function draw(index, force) {
    const i = nearestLoaded(index);
    if (i < 0 || (i === drawn && !force)) return;
    const img = frames[i];
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    drawn = i;
    sampleTone();
  }

  /* ---------- 3. Text tone follows the car colour behind it ---------- */
  const probe = document.createElement("canvas");
  probe.width = 48; probe.height = 27;
  const pctx = probe.getContext("2d", { willReadFrequently: true });
  let tone = "light", canSample = true, activeScene = null;
  function sampleTone() {
    if (!activeScene) return;
    let next = activeScene.el.dataset.tone || null;
    if (!next && canSample) {
      try {
        pctx.drawImage(canvas, 0, 0, probe.width, probe.height);
        const r = activeScene.el.getBoundingClientRect();
        const x = Math.max(0, Math.floor((r.left / cw) * probe.width));
        const y = Math.max(0, Math.floor((r.top / ch) * probe.height));
        const w = Math.max(1, Math.min(probe.width - x, Math.ceil((r.width / cw) * probe.width)));
        const h = Math.max(1, Math.min(probe.height - y, Math.ceil((r.height / ch) * probe.height)));
        const d = pctx.getImageData(x, y, w, h).data;
        let sum = 0;
        for (let k = 0; k < d.length; k += 4) sum += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
        const lum = sum / (d.length / 4) / 255;
        // hysteresis so the text doesn't flicker at the threshold
        next = tone === "dark" ? (lum < 0.46 ? "light" : "dark") : (lum > 0.56 ? "dark" : "light");
      } catch (e) { canSample = false; } // file:// taints the canvas; fallback to light text
    }
    if (next && next !== tone) { tone = next; stage.dataset.tone = tone; }
  }

  /* ---------- 4. Scroll → frame + scenes ---------- */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  let progress = 0, current = 0, introT = reduceMotion ? 1 : 0;
  const hudNum = $("#hudNum"), hudBar = $("#hudBar"), hint = $("#scrollHint"), nav = $("#nav");

  function readProgress() {
    const r = hero.getBoundingClientRect();
    const total = hero.offsetHeight - innerHeight;
    progress = clamp(-r.top / total);
    nav.classList.toggle("is-scrolled", scrollY > 40);
  }

  function updateScenes(p) {
    let active = null, activeIdx = 0;
    scenes.forEach((s, idx) => {
      const span = s.to - s.from;
      const inEdge = s.from + span * 0.3, outEdge = s.to - span * 0.22;
      let vin = s.holdStart ? 1 : clamp((p - s.from) / (inEdge - s.from));
      let vout = s.holdEnd ? 1 : clamp((s.to - p) / (s.to - outEdge));
      if (s.holdStart) vin = introT;
      if (p < s.from && !s.holdStart) vin = 0;
      if (p > s.to && !s.holdEnd) vout = 0;
      vin = easeOut(vin); vout = easeOut(vout);
      const o = Math.min(vin, vout);
      s.el.style.setProperty("--in", vin.toFixed(4));
      s.el.style.setProperty("--o", o.toFixed(4));
      s.el.style.translate = `0 ${(-(1 - vout) * 60).toFixed(1)}px`;
      s.el.style.filter = vout < 1 ? `blur(${((1 - vout) * 8).toFixed(1)}px)` : "";
      s.el.classList.toggle("is-on", o > 0.001);
      s.counters.forEach(c => {
        const dec = +(c.dataset.dec || 0);
        c.textContent = (+c.dataset.count * vin).toFixed(dec);
      });
      if (o > 0.3 && (!active || o > active.o)) { active = { ...s, o }; activeIdx = idx; }
    });
    if (active) {
      activeScene = active;
      hudNum.textContent = String(activeIdx + 1).padStart(2, "0");
    }
    hudBar.style.transform = `scaleY(${p.toFixed(4)})`;
    hint.classList.toggle("is-hidden", p > 0.015);
  }

  let needDraw = false, forceDraw = false;
  function requestDraw(force) { needDraw = true; if (force) forceDraw = true; }

  function tick(time) {
    readProgress();
    const target = progress * (FRAME_COUNT - 1);
    // a light extra easing on top of Lenis so frame changes glide
    current += (target - current) * (reduceMotion ? 1 : 0.22);
    if (Math.abs(target - current) < 0.01) current = target;
    const idx = Math.round(current);
    if (idx !== drawn || needDraw) { draw(idx, forceDraw); needDraw = forceDraw = false; }
    updateScenes(current / (FRAME_COUNT - 1));
    requestAnimationFrame(tick);
  }

  /* ---------- 5. Smooth scroll ---------- */
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new Lenis({ lerp: 0.075, smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
    lenis.stop();
    window.lenis = lenis;
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }
  const scrollToY = y => lenis ? lenis.scrollTo(y, { duration: 2.2 }) : scrollTo({ top: y, behavior: "smooth" });
  const heroEnd = () => hero.offsetTop + hero.offsetHeight - innerHeight;

  /* ---------- 6. Reveal after first batch ---------- */
  function reveal() {
    if (revealed) return;
    revealed = true;
    pctEl.textContent = 100; barEl.style.transform = "scaleX(1)";
    requestDraw(true);
    setTimeout(() => {
      $("#loader").classList.add("is-done");
      document.body.classList.remove("is-loading");
      lenis && lenis.start();
      document.dispatchEvent(new Event("bmw:ready"));
      // intro text plays in on its own, then belongs to the scroll
      const t0 = performance.now();
      const play = now => {
        introT = clamp((now - t0) / 1400);
        if (introT < 1) requestAnimationFrame(play);
      };
      if (!reduceMotion) requestAnimationFrame(play);
    }, 350);
  }

  /* ---------- 7. Nav ---------- */
  const burger = $("#burger");
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    burger.setAttribute("aria-expanded", open);
    open ? lenis?.stop() : lenis?.start();
  });
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
    const id = a.getAttribute("href");
    e.preventDefault();
    nav.classList.remove("is-open"); burger.setAttribute("aria-expanded", false); lenis?.start();
    if (id === "#top") return scrollToY(0);
    if (id === "#search") return scrollToY(heroEnd());
    const el = document.querySelector(id);
    if (el) scrollToY(el.getBoundingClientRect().top + scrollY);
  }));

  /* ---------- 8. Model search (demo data until the models section is built) ---------- */
  const MODELS = [
    ["M2", "Coupé"], ["M3", "Saloon"], ["M3 Touring", "Touring"], ["M4", "Coupé"], ["M4 Convertible", "Convertible"],
    ["M5", "Saloon"], ["M8", "Gran Coupé"], ["X3 M", "SAV"], ["X5 M", "SAV"], ["X6 M", "SAC"], ["XM", "SAV"],
    ["1 Series", "Hatchback"], ["2 Series", "Coupé"], ["3 Series", "Saloon"], ["4 Series", "Gran Coupé"],
    ["5 Series", "Saloon"], ["7 Series", "Saloon"], ["8 Series", "Coupé"], ["X1", "SAV"], ["X3", "SAV"],
    ["X5", "SAV"], ["X7", "SAV"], ["Z4", "Roadster"], ["i4", "Electric Gran Coupé"], ["i5", "Electric Saloon"],
    ["i7", "Electric Saloon"], ["iX", "Electric SAV"], ["iX1", "Electric SAV"], ["iX3", "Electric SAV"],
  ];
  const form = $("#searchForm"), input = $("#searchInput"), list = $("#searchList");
  let hits = [], sel = -1;
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function render() {
    const q = input.value.trim().toLowerCase();
    hits = q ? MODELS.filter(([n, t]) => (n + " " + t).toLowerCase().includes(q)).slice(0, 6) : [];
    sel = -1;
    list.hidden = !hits.length;
    list.innerHTML = hits.map(([n, t], i) => {
      const k = n.toLowerCase().indexOf(q);
      const name = k > -1 ? esc(n.slice(0, k)) + "<b>" + esc(n.slice(k, k + q.length)) + "</b>" + esc(n.slice(k + q.length)) : esc(n);
      return `<li role="option" data-i="${i}">${name}<small>${esc(t)}</small></li>`;
    }).join("");
  }
  function choose(name) {
    input.value = name; list.hidden = true;
    document.dispatchEvent(new CustomEvent("bmw:search", { detail: { model: name } }));
    const next = $("#overview");
    scrollToY(next.getBoundingClientRect().top + scrollY);
  }
  input.addEventListener("input", render);
  input.addEventListener("keydown", e => {
    if (!hits.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length;
      [...list.children].forEach((li, i) => li.classList.toggle("is-active", i === sel));
    } else if (e.key === "Escape") list.hidden = true;
  });
  list.addEventListener("mousedown", e => {
    const li = e.target.closest("li"); if (li) { e.preventDefault(); choose(hits[+li.dataset.i][0]); }
  });
  input.addEventListener("blur", () => setTimeout(() => (list.hidden = true), 120));
  form.addEventListener("submit", e => {
    e.preventDefault();
    const q = input.value.trim();
    if (!q) return input.focus();
    choose(sel > -1 ? hits[sel][0] : (hits[0]?.[0] || q));
  });
  $("#chips").addEventListener("click", e => {
    const b = e.target.closest("button"); if (b) { input.value = b.textContent; render(); input.focus(); }
  });

  /* ---------- go ---------- */
  addEventListener("resize", resize);
  resize();
  loadAll();
  requestAnimationFrame(tick);
})();
