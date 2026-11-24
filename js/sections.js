/* =========================================================
   BMW M4 Competition: section animations (GSAP + ScrollTrigger)
   Lenis is created in hero.js and shared via window.lenis.
   ========================================================= */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- colour configurator (works with or without GSAP) ---------- */
  const frame = $("#colFrame"), sw = $$(".col__sw button");
  const colName = $("#colName"), colType = $("#colType"), colBig = $("#colBig"), colSec = $(".col");
  let busy = false;
  sw.forEach(b => b.addEventListener("click", () => {
    if (b.classList.contains("is-on") || busy) return;
    const prev = $("img.is-on", frame), next = $(`img[data-c="${b.dataset.c}"]`, frame);
    sw.forEach(x => { x.classList.toggle("is-on", x === b); x.setAttribute("aria-checked", x === b); });
    colSec.style.setProperty("--sw", getComputedStyle(b).getPropertyValue("--sw"));
    const swapText = () => { colName.textContent = b.dataset.name; colType.textContent = b.dataset.type; colBig.textContent = b.dataset.big; };
    if (!window.gsap || RM) {
      prev.classList.remove("is-on"); next.classList.add("is-on"); swapText(); return;
    }
    busy = true;
    gsap.set(next, { opacity: 1, zIndex: 2, clipPath: "inset(0% 0% 0% 100%)", scale: 1.08 });
    gsap.timeline({ onComplete: () => {
        prev.classList.remove("is-on"); gsap.set(prev, { opacity: 0, zIndex: 0 });
        next.classList.add("is-on"); gsap.set(next, { zIndex: 1, clearProps: "clipPath" }); busy = false;
      } })
      .to(next, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.1, ease: "expo.inOut" })
      .to(next, { scale: 1, duration: 1.6, ease: "expo.out" }, .3)
      .to([colName, colType], { yPercent: -40, opacity: 0, duration: .3, ease: "power2.in", stagger: .04 }, 0)
      .add(swapText, .35)
      .fromTo([colName, colType], { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .6, ease: "power3.out", stagger: .05 }, .36)
      .fromTo(colBig, { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .9, ease: "power3.out" }, .3);
  }));

  /* ---------- test drive form ---------- */
  const form = $("#tdForm"), note = $("#tdNote");
  form.addEventListener("submit", e => {
    e.preventDefault();
    let ok = true;
    $$("input[required]", form).forEach(i => {
      const bad = !i.value.trim() || (i.type === "email" && !/^\S+@\S+\.\S+$/.test(i.value));
      i.closest(".fld").classList.toggle("is-bad", bad);
      if (bad) ok = false;
    });
    if (!ok) { note.style.color = "#ff7a7a"; note.textContent = "Please fill in all fields with valid details."; return; }
    const d = new FormData(form);
    const first = String(d.get("name")).trim().split(" ")[0];
    note.style.color = "";
    note.textContent = `Thanks, ${first}. Your ${d.get("version")} test drive request has been received.`;
    form.reset();
  });
  $$("input", form).forEach(i => i.addEventListener("input", () => i.closest(".fld").classList.remove("is-bad")));

  /* ---------- counters ---------- */
  const fmt = (el, v) => {
    const dec = +(el.dataset.dec || 0), n = +el.dataset.count * v;
    el.textContent = dec ? n.toFixed(dec) : Math.round(n).toLocaleString("en-GB");
  };

  if (!window.gsap || !window.ScrollTrigger || RM) {
    $$("[data-count]", $(".perf")).forEach(el => fmt(el, 1));
    $$(".vc").forEach(v => v.classList.add("is-in"));
    document.documentElement.classList.add("no-motion");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  if (window.lenis) window.lenis.on("scroll", ScrollTrigger.update);

  /* ---------- heading line reveals ---------- */
  $$(".h2, .stm__txt").forEach(h => {
    if (h.closest(".perf")) return; // performance heading is part of the pinned timeline
    gsap.from($$(".ln>span", h), {
      yPercent: 115, rotate: 3, duration: 1.2, ease: "expo.out", stagger: .09,
      scrollTrigger: { trigger: h, start: "top 86%" }
    });
  });
  $$(".kicker").forEach(k => {
    if (k.closest(".perf")) return;
    gsap.from(k, { x: -30, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: k, start: "top 90%" } });
  });
  $$(".rv").forEach(el => gsap.from(el, {
    y: 46, opacity: 0, duration: 1.1, ease: "power3.out",
    scrollTrigger: { trigger: el, start: "top 90%" }
  }));

  /* ---------- image reveal (cover wipes away) + inner parallax ---------- */
  $$(".clip").forEach(fig => {
    const cover = document.createElement("span");
    cover.style.cssText = "position:absolute;inset:0;z-index:3;background:#d4ef00;transform-origin:top";
    fig.appendChild(cover);
    const img = $("img", fig);
    gsap.timeline({ scrollTrigger: { trigger: fig, start: "top 88%" } })
      .fromTo(cover, { scaleY: 1 }, { scaleY: 0, duration: 1.1, ease: "expo.inOut", transformOrigin: "top" })
      .fromTo(img, { scale: 1.45 }, { scale: 1.18, duration: 1.8, ease: "expo.out" }, .25);
    gsap.fromTo(img, { yPercent: -7 }, {
      yPercent: 7, ease: "none",
      scrollTrigger: { trigger: fig, start: "top bottom", end: "bottom top", scrub: true }
    });
  });

  /* ---------- free-floating parallax ---------- */
  $$("[data-speed]").forEach(el => {
    const s = parseFloat(el.dataset.speed);
    gsap.fromTo(el, { y: () => -s * innerHeight * .5 }, {
      y: () => s * innerHeight * .5, ease: "none",
      scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true }
    });
  });
  gsap.fromTo(".ov__word span", { xPercent: 12 }, {
    xPercent: -12, ease: "none",
    scrollTrigger: { trigger: ".ov", start: "top bottom", end: "bottom top", scrub: true }
  });
  gsap.from(".ov__facts li", {
    x: 40, opacity: 0, duration: .9, ease: "power3.out", stagger: .1,
    scrollTrigger: { trigger: ".ov__facts", start: "top 88%" }
  });

  /* ---------- marquee follows scroll ---------- */
  gsap.fromTo(".mq__track", { xPercent: -2 }, {
    xPercent: -38, ease: "none",
    scrollTrigger: { trigger: ".mq", start: "top bottom", end: "bottom top", scrub: .6 }
  });

  /* ---------- performance: image opens to full screen, stats count up ---------- */
  const stats = $$(".perf__stats li");
  const ptl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: ".perf", start: "top top", end: "+=220%", pin: true, scrub: 1, anticipatePin: 1 }
  });
  ptl.fromTo(".perf__media", { clipPath: "inset(16% 24% 16% 24%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1, ease: "power2.inOut" })
     .to(".perf__media img", { scale: 1, duration: 1.8 }, 0)
     .to(".perf__shade", { opacity: 1, duration: .6 }, .5)
     .from(".perf__head .kicker", { x: -30, opacity: 0, duration: .3 }, .75)
     .from(".perf__head .ln>span", { yPercent: 115, duration: .5, stagger: .1, ease: "power3.out" }, .8);
  stats.forEach((li, i) => {
    const t = 1.05 + i * .14, num = $("[data-count]", li), o = { v: 0 };
    ptl.from(li, { y: 60, opacity: 0, duration: .4, ease: "power3.out" }, t)
       .to(o, { v: 1, duration: .6, ease: "power2.out", onUpdate: () => { fmt(num, o.v); li.style.setProperty("--p", o.v); } }, t);
  });
  ptl.to({}, { duration: .4 }); // short hold before releasing the pin

  /* ---------- engine list ---------- */
  gsap.from(".eng__list li", {
    x: 50, opacity: 0, duration: 1, ease: "power3.out", stagger: .12,
    scrollTrigger: { trigger: ".eng__list", start: "top 85%" }
  });

  /* ---------- gallery: pinned horizontal scroll on desktop ---------- */
  const mm = gsap.matchMedia();
  const track = $(".gal__track"), bar = $(".gal__bar i");
  mm.add("(min-width: 900px)", () => {
    const dist = () => track.scrollWidth - innerWidth;
    const hz = gsap.to(track, {
      x: () => -dist(), ease: "none",
      scrollTrigger: {
        trigger: ".gal", start: "top top", end: () => "+=" + dist(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: self => gsap.set(bar, { scaleX: self.progress })
      }
    });
    $$(".card").forEach(card => {
      const img = $("img", card);
      gsap.fromTo(img, { xPercent: -7 }, {
        xPercent: 7, ease: "none",
        scrollTrigger: { trigger: card, containerAnimation: hz, start: "left right", end: "right left", scrub: true }
      });
      // cards already on screen when the pin starts can't "enter" through the
      // container animation, so they reveal with a normal trigger instead
      const early = card.offsetLeft < innerWidth;
      const st = early ? { trigger: ".gal", start: "top 60%" } : { trigger: card, containerAnimation: hz, start: "left 100%" };
      gsap.timeline({ scrollTrigger: st, delay: early ? $$(".card").indexOf(card) * .15 : 0 })
        .fromTo($(".card__img", card), { clipPath: "inset(0% 0% 0% 100%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.2, ease: "expo.inOut" })
        .from($("figcaption", card), { y: 20, opacity: 0, duration: .8, ease: "power3.out" }, "-=.5");
    });
    return () => gsap.set(bar, { scaleX: 0 });
  });
  mm.add("(max-width: 899px)", () => {
    const onScroll = () => {
      const max = track.scrollWidth - track.clientWidth;
      gsap.set(bar, { scaleX: max > 0 ? track.scrollLeft / max : 0 });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    gsap.from(".card", {
      y: 50, opacity: 0, duration: 1, ease: "power3.out", stagger: .08,
      scrollTrigger: { trigger: track, start: "top 85%" }
    });
    return () => track.removeEventListener("scroll", onScroll);
  });

  /* ---------- colours ---------- */
  gsap.fromTo("#colFrame", { clipPath: "polygon(0 0,0 0,0 100%,0 100%,0 100%)" }, {
    clipPath: "polygon(0 0,100% 0,100% 88%,93% 100%,0 100%)", duration: 1.6, ease: "expo.inOut",
    scrollTrigger: { trigger: "#colFrame", start: "top 82%" },
    onComplete: () => gsap.set("#colFrame", { clearProps: "clipPath" })
  });
  gsap.from(".col__ui > *", {
    y: 40, opacity: 0, duration: 1, ease: "power3.out", stagger: .1,
    scrollTrigger: { trigger: ".col__ui", start: "top 90%" }
  });
  gsap.from(".col__sw button", {
    scale: 0, duration: .8, ease: "back.out(2)", stagger: .06,
    scrollTrigger: { trigger: ".col__sw", start: "top 92%" }
  });
  gsap.fromTo(".col__name", { xPercent: 8 }, {
    xPercent: -8, ease: "none",
    scrollTrigger: { trigger: ".col", start: "top bottom", end: "bottom top", scrub: true }
  });

  /* ---------- statement + test-drive backgrounds ---------- */
  [[".stm__media", ".stm"], [".cta__media", ".cta"]].forEach(([m, t]) => {
    gsap.fromTo(m, { yPercent: -8 }, {
      yPercent: 8, ease: "none",
      scrollTrigger: { trigger: t, start: "top bottom", end: "bottom top", scrub: true }
    });
  });
  gsap.fromTo(".stm__media img", { scale: 1.25 }, {
    scale: 1, ease: "none",
    scrollTrigger: { trigger: ".stm", start: "top bottom", end: "center center", scrub: true }
  });

  /* ---------- specs: rows draw in ---------- */
  $$(".spec__group").forEach(g => {
    const rows = $$("dl>div", g);
    gsap.timeline({ scrollTrigger: { trigger: g, start: "top 85%" } })
      .from($("h3", g), { x: -20, opacity: 0, duration: .6, ease: "power3.out" })
      .fromTo(rows, { "--l": 0 }, { "--l": 1, duration: 1.1, ease: "expo.inOut", stagger: .08 }, 0)
      .from(rows.map(r => r.children), { y: 18, opacity: 0, duration: .8, ease: "power3.out", stagger: .05 }, .2);
  });

  /* ---------- compare cards ---------- */
  gsap.from(".vc", {
    y: 80, opacity: 0, duration: 1.1, ease: "expo.out", stagger: .12,
    scrollTrigger: { trigger: ".cmp__grid", start: "top 85%", onEnter: () => $$(".vc").forEach(v => v.classList.add("is-in")) }
  });

  /* ---------- footer ---------- */
  gsap.from(".foot__word", {
    yPercent: 60, opacity: 0, duration: 1.4, ease: "expo.out",
    scrollTrigger: { trigger: ".foot", start: "top 90%" }
  });

  /* refresh once fonts, images and the hero loader are done */
  ScrollTrigger.sort();
  const refresh = () => { ScrollTrigger.sort(); ScrollTrigger.refresh(); };
  document.addEventListener("bmw:ready", refresh);
  addEventListener("load", refresh);
  document.fonts && document.fonts.ready.then(refresh);
})();
