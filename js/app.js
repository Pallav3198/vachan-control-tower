/* VACHAN: a playable control room. State, live loop, screens and missions. */
(function () {
  "use strict";
  const M = window.VachanModel, D = window.VachanData;
  const KEY = "vachan-demo-v2";
  const SPEED = 2 / 3; // simulated hours per real second
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const num = (n, d) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const cr = (n, d) => (n < 0 ? "-" : "") + "₹" + num(Math.abs(n), d == null ? 2 : d) + " Cr";
  const WHY = { P: "Line stops without it", S: "Big contract", C: "Has a deadline", F: "Flexible" };
  const TIER = { P: "Can't wait", S: "Important", C: "Deadline", F: "Flexible" };
  const CAT = ["#1463D6", "#0FA08E", "#F2A20C", "#7B4FD0"];
  const CLASSES = ["Automatic", "AI suggests", "Human decides", "Leadership"];
  const REASONS = ["The data was wrong", "I know something it doesn't", "Commercial judgement", "Other"];

  function fresh() {
    return { clock: 0, orders: D.orders(), lots: clone(D.LOTS), nodes: clone(D.NODES), decisions: clone(D.DECISIONS), pilots: clone(D.PILOTS), alerts: {}, audit: [], feed: [], alloc: clone(M.EXHIBIT8), allocDecision: null, value: clone(M.BASE), valueMode: "BASE", recovered: 0, missions: { line: false, pipe: false, stock: false }, running: true, hist: Object.assign({}, D.HISTORY), nextId: 49000, autoCount: 0, welcomed: false };
  }
  function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.orders ? v : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* the demo still works without storage */ } }
  let S = load();
  const firstRun = !S;
  if (!S) S = fresh();
  let DR = null;
  const UI = { q: "", tq: "", customer: null, reasoning: false };

  // ---------------------------------------------------------------- art
  const IC = {
    check: c => `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    bang: c => `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2.5v7" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/><circle cx="8" cy="13" r="1.6" fill="${c}"/></svg>`,
    truck: c => `<svg width="18" height="14" viewBox="0 0 18 14"><rect x="0" y="1" width="10.5" height="9" rx="1.6" fill="${c}"/><path d="M11.5 4h3l3 3v3h-6z" fill="${c}"/><circle cx="4" cy="11.5" r="2" fill="${c}"/><circle cx="14" cy="11.5" r="2" fill="${c}"/></svg>`,
    spark: c => `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1l1.8 5.2L15 8l-5.2 1.8L8 15l-1.8-5.2L1 8l5.2-1.8z" fill="${c}"/></svg>`,
    play: `<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>`,
    pause: `<svg width="14" height="14" viewBox="0 0 14 14"><rect x="2.5" y="1.5" width="3.2" height="11" rx="1" fill="currentColor"/><rect x="8.3" y="1.5" width="3.2" height="11" rx="1" fill="currentColor"/></svg>`,
    pool: `<svg width="26" height="20" viewBox="0 0 18 14"><rect x="0" y="1" width="10.5" height="9" rx="1.6" fill="currentColor"/><path d="M11.5 4h3l3 3v3h-6z" fill="currentColor"/><circle cx="4" cy="11.5" r="2" fill="currentColor"/><circle cx="14" cy="11.5" r="2" fill="currentColor"/></svg>`,
    shield: `<svg width="24" height="26" viewBox="0 0 24 26"><path d="M12 1l10 4v8c0 6-4.4 10.4-10 12C6.4 23.4 2 19 2 13V5z" fill="currentColor"/><path d="M7.5 13l3.2 3.2L16.8 10" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    bolt: `<svg width="20" height="26" viewBox="0 0 20 26"><path d="M12 1L1 15h7l-1 10 12-15h-8z" fill="currentColor"/></svg>`,
    box: `<svg width="26" height="26" viewBox="0 0 26 26"><path d="M13 2l10 5v12l-10 5-10-5V7z" fill="currentColor"/><path d="M3 7l10 5 10-5M13 12v12" stroke="#fff" stroke-width="1.6" fill="none"/></svg>`
  };
  const truckArt = (c, w) => `<svg viewBox="0 0 66 38" width="${w || 66}"><rect x="2" y="5" width="38" height="23" rx="4" fill="${c}"/><path d="M42 12h11l10 10v6H42z" fill="${c}"/><path d="M46 15h6l6 7H46z" fill="#fff" opacity=".9"/><g class="spin"><circle cx="14" cy="30" r="6.5" fill="#22324D"/><circle cx="14" cy="26.5" r="1.3" fill="#fff"/><circle cx="14" cy="30" r="2.2" fill="#fff"/></g><g class="spin"><circle cx="51" cy="30" r="6.5" fill="#22324D"/><circle cx="51" cy="26.5" r="1.3" fill="#fff"/><circle cx="51" cy="30" r="2.2" fill="#fff"/></g></svg>`;
  const carArt = c => `<svg viewBox="0 0 92 40" width="92"><path d="M3 30c0-7 4-9 12-10 5-7 12-12 25-12 11 0 17 5 24 12 15 1 25 3 25 10v3H3z" fill="${c}"/><path d="M24 20c4-5 9-8 16-8v8zM45 12c6 0 11 3 15 8H45z" fill="#fff" opacity=".85"/><circle cx="23" cy="33" r="7" fill="#22324D"/><circle cx="23" cy="33" r="2.6" fill="#fff"/><circle cx="70" cy="33" r="7" fill="#22324D"/><circle cx="70" cy="33" r="2.6" fill="#fff"/></svg>`;
  const coilArt = (c, s) => `<svg viewBox="0 0 44 44" width="${s || 44}"><circle cx="22" cy="22" r="21" fill="${c}"/><circle cx="22" cy="22" r="16" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.6"/><circle cx="22" cy="22" r="12" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.6"/><circle cx="22" cy="22" r="7.5" fill="#fff"/></svg>`;
  const artLine = (tag) => `<div class="road" style="background:linear-gradient(#EAF2FF 72%,#CFDDF2 72%);min-height:inherit">${[0, 2, 4].map((d, i) => `<div class="drive" style="bottom:22%;animation-delay:-${d}s">${carArt(CAT[i])}</div>`).join("")}${tag ? `<div class="pill bad bob" style="position:absolute;top:14px;left:50%;margin-left:-74px;font-size:16px;padding:6px 15px">${tag}</div>` : ""}</div>`;
  const artRoad = (tag) => `<div class="road" style="background:linear-gradient(#FFF4DF 66%,#D9DEE7 66%);min-height:inherit">${[0, 1.5, 3, 4.5].map((d, i) => `<div class="drive" style="bottom:20%;animation-delay:-${d}s;animation-duration:7s">${truckArt(["#F2A20C", "#1463D6", "#0FA08E", "#E5484D"][i])}</div>`).join("")}${tag ? `<div class="pill warn bob" style="position:absolute;top:14px;left:50%;margin-left:-60px;font-size:16px;padding:6px 15px">${tag}</div>` : ""}</div>`;
  const artYard = (tag) => `<div class="road" style="background:linear-gradient(#F0EBFF 70%,#DAD3EE 70%);min-height:inherit;display:grid;place-items:center"><div style="display:flex;gap:5px;align-items:flex-end;padding-top:20px">${["#8E9BB0", "#A2ADBF", "#7B4FD0", "#8E9BB0", "#A2ADBF", "#8E9BB0"].map((c, i) => `<div style="display:grid;gap:3px" class="${i === 2 ? "bob" : ""}">${i % 2 ? coilArt(c, 40) : ""}${coilArt(c, 40)}</div>`).join("")}</div>${tag ? `<div class="pill plum bob" style="position:absolute;top:12px;left:50%;margin-left:-70px;font-size:16px;padding:6px 15px">${tag}</div>` : ""}</div>`;

  // ---------------------------------------------------------------- time and orders
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function when(h) {
    if (h == null) return "-";
    const t = Math.floor(h + 9), day = Math.floor(t / 24), hr = ((t % 24) + 24) % 24, name = DAYS[((day % 7) + 7) % 7];
    const ap = hr === 0 ? "12 am" : hr < 12 ? hr + " am" : hr === 12 ? "12 pm" : hr - 12 + " pm";
    return (day >= 7 ? "next " : day < 0 ? "last " : "") + name + " " + ap;
  }
  function hm(h) { const a = Math.abs(h), H = Math.floor(a), m = Math.round((a - H) * 60); return H + "h " + String(m).padStart(2, "0") + "m"; }
  function view(o) {
    const c = S.clock;
    let stage;
    if (o.confirm == null) stage = "Waiting for a date";
    else if (c >= o.eta) stage = "Delivered";
    else if (c >= o.dispatch) stage = "On the road";
    else if (c >= o.produced) stage = "Made";
    else stage = "Scheduled";
    const signal = M.bestSignal(o.sig), moving = stage === "On the road";
    const conf = moving ? (o.mode === "Rail" ? 0.9 : signal.confidence) : 0.85;
    const slack = o.confirm == null ? null : o.promise - o.eta, done = stage === "Delivered";
    const p = o.confirm == null || done ? 0 : M.lateProbability(slack, conf);
    return { o, stage, signal, conf, slack, done, moving, p, money: p * ((o.t * o.margin) / 1e7 + (o.penaltyCr || 0)), onTime: done && o.eta <= o.promise };
  }
  const riskPill = p => p >= 0.75 ? `<span class="pill bad">Likely late</span>` : p >= 0.5 ? `<span class="pill warn">At risk</span>` : `<span class="pill good">On track</span>`;
  const nodeName = id => { const n = S.nodes.find(x => x.id === id); return n ? n.label : id; };
  const lotValue = l => (l.kt * 1000 * 65000 * 0.1) / 1e7;

  function playbook(o) {
    if (o.tier === "P" && o.cover < 5) return { key: "Send it first", text: "Dispatch this order first, and bridge the gap by road with steel already moving.", hours: 30, ic: "shield" };
    if (o.spc) return { key: "Use nearby stock", text: `Serve it from matching steel already sitting at ${nodeName(o.spc)}.`, hours: 40, ic: "box", lot: true };
    if (o.lots >= 3) return { key: "Pool the loads", text: `Combine ${o.lots} half-empty trucks into fewer full ones.`, hours: 12 + o.lots * 7, ic: "pool" };
    return { key: "Speed it up", text: "Move it to a faster route and warn the customer early.", hours: 20, ic: "bolt" };
  }
  function headline(v) {
    const o = v.o, late = Math.max(0, Math.round(-v.slack));
    if (o.tier === "P" && o.cover < 5) return `${o.customer}'s line has ${o.cover.toFixed(0)} days of steel left`;
    if (o.spc) return `${o.customer}'s steel is late, but the same steel is nearby`;
    if (o.lots >= 3) return `${o.customer}'s steel is split across ${o.lots} half-empty trucks`;
    return late ? `${o.customer}'s steel is running ${late} hours late` : `${o.customer}'s delivery is cutting it close`;
  }
  function applyFix(o, pb) { o.eta = Math.max(S.clock + 2, o.eta - pb.hours); if (pb.key === "Pool the loads") o.lots = Math.max(2, Math.ceil(o.lots / 2)); }
  function previewP(o, pb) { const c = Object.assign({}, o, { eta: Math.max(S.clock + 2, o.eta - pb.hours) }); return view(c).p; }

  function feed(kind, text) { S.feed.unshift({ t: S.clock, kind, text, id: Math.random().toString(36).slice(2) }); S.feed.length = Math.min(S.feed.length, 40); }
  function log(what, why, who) { S.audit.unshift({ t: S.clock, who: who || "You", what, why: why || "" }); }

  function syncAlerts(quiet) {
    S.orders.forEach(o => {
      const v = view(o);
      if (v.done || v.p < 0.5 || S.alerts[o.id]) return;
      if (!o.story && o.tier !== "P" && v.money < 0.5) {
        const pb = playbook(o); applyFix(o, pb);
        S.alerts[o.id] = { status: "auto", raised: S.clock, at: S.clock, by: "VACHAN" }; S.autoCount++;
        log(`${pb.key}: ${o.id} (${o.customer})`, "Small and reversible, so handled automatically.", "VACHAN");
        if (!quiet) feed("auto", `Handled by itself: ${pb.key.toLowerCase()} for ${o.customer}`);
      } else {
        S.alerts[o.id] = { status: "open", raised: S.clock, level: 1 };
        if (!quiet) feed("alert", `New for you: ${headline(v)}`);
      }
    });
  }
  const openEx = () => S.orders.filter(o => S.alerts[o.id] && S.alerts[o.id].status === "open").map(o => ({ v: view(o), a: S.alerts[o.id], pb: playbook(o) })).filter(e => !e.v.done).sort((x, y) => y.v.money - x.v.money);
  const LEVELS = { 1: "with the planner", 2: "with the Promise Owner", 3: "with the weekly Commit Room" };
  const levelOf = a => { const age = S.clock - a.raised; return age < 2 ? 1 : age < 4 ? 2 : 3; };

  function kpis() {
    const list = S.orders.map(view), H = S.hist, conf = list.filter(v => v.o.confirm != null);
    const good = conf.filter(v => (v.done ? v.onTime : v.p < 0.5)).length;
    const risk = list.filter(v => !v.done && v.p >= 0.5);
    return { otif: ((H.onTime + good) / (H.lines + conf.length)) * 100, avg: conf.reduce((a, v) => a + (v.o.confirm - v.o.created), 0) / (conf.length || 1), risk: risk.length, money: risk.reduce((a, v) => a + v.money, 0), pending: list.filter(v => v.o.confirm == null).length, moving: list.filter(v => v.moving).length, stock: S.nodes.reduce((a, n) => a + n.stock, 0) / D.DAILY_KT };
  }

  function accept(id, by) {
    const o = S.orders.find(x => x.id === id), a = S.alerts[id]; if (!o || !a) return null;
    const pb = playbook(o), before = view(o).p;
    applyFix(o, pb);
    if (pb.lot) { const l = S.lots.find(x => !x.done && x.match === o.customer && Math.abs(x.kt * 1000 - o.t) < 1); if (l) doMatch(l); }
    Object.assign(a, { status: "accepted", at: S.clock, by: by || "You" });
    const after = view(o).p;
    log(`${pb.key}: ${o.id} (${o.customer})`, `Chance of being late went from ${Math.round(before * 100)}% to ${Math.round(after * 100)}%.`, by || "You");
    feed("you", `You fixed it: ${o.customer}, ${pb.key.toLowerCase()}`);
    return { before, after };
  }
  function doMatch(l) {
    if (l.done) return; l.done = true;
    const n = S.nodes.find(x => x.id === l.node); n.stock = Math.max(0, +(n.stock - l.kt).toFixed(1)); S.recovered += lotValue(l);
    log(`Matched ${l.id} to ${l.match}`, `${l.kt.toFixed(1)} KT, ${l.age} days old. Saved ${cr(lotValue(l))}.`);
    feed("you", `Old stock found a home: ${l.kt.toFixed(1)} KT to ${l.match}`);
  }
  function confirmOrder(id) {
    const o = S.orders.find(x => x.id === id), base = S.nodes.find(n => n.id === o.dest).stock > 100 ? 36 : 60;
    o.confirm = Math.max(o.created + 0.5, S.clock + 0.2); o.produced = S.clock + base * 0.4; o.dispatch = S.clock + base; o.eta = o.dispatch + 40; o.promise = o.eta + 24;
    log(`Gave ${o.id} a date`, `${when(o.promise)}, ${hm(o.confirm - o.created)} after the order came in.`);
    feed("you", `${o.customer} now has a date: ${when(o.promise)}`);
  }

  // ---------------------------------------------------------------- live loop
  function hourTick(hour) {
    S.orders.forEach((o, idx) => {
      const v = view(o);
      if (v.done && !o.told) { o.told = true; feed(v.onTime ? "good" : "alert", `${o.customer}'s steel reached ${nodeName(o.dest)} ${v.onTime ? "on time" : "late"}`); }
      if (v.moving && !o.story && !(S.alerts[o.id] && S.alerts[o.id].status !== "open") && D.rng(hour * 1000 + idx)() < 0.012) { const add = 8 + Math.round(D.rng(hour * 77 + idx)() * 18); o.eta += add; feed("alert", `A truck to ${nodeName(o.dest)} just slowed down by ${add} hours`); log(`Delay spotted on ${o.id}`, `${add} hours later, seen via ${v.signal.label}.`, "VACHAN"); }
    });
    const R = D.rng(hour * 991);
    const moving = S.orders.map(view).filter(v => v.moving);
    if (moving.length && R() < 0.3) { const v = moving[Math.floor(R() * moving.length)]; feed("truck", `${v.o.customer}'s ${v.o.mode === "Rail" ? "rake" : "truck"} is on its way to ${nodeName(v.o.dest)}`); }
    if (hour % 4 === 0) { const o = D.spawn(S.nextId++, S.clock, R); S.orders.push(o); feed("good", `New order from ${o.customer}, date given in ${hm(o.confirm - o.created)}`); }
    S.orders = S.orders.filter(o => { const v = view(o); if (v.done && !o.story && S.clock - o.eta > 30) { S.hist.lines++; if (v.onTime) S.hist.onTime++; delete S.alerts[o.id]; return false; } return true; });
    syncAlerts();
    Object.keys(S.alerts).forEach(id => { const a = S.alerts[id]; if (a.status !== "open") return; const l = levelOf(a); if (l > a.level) { a.level = l; log(`Escalated ${id}`, `Now ${LEVELS[l]}.`, "VACHAN"); } });
  }
  function advance(h) {
    while (h > 1e-9) {
      const next = Math.floor(S.clock) + 1, step = Math.min(h, next - S.clock);
      S.orders.forEach(o => { if (o.story && !S.missions[o.story] && o.confirm != null) { o.eta += step; o.promise += step; o.dispatch += step; o.produced += step; } });
      S.clock += step; h -= step;
      if (next - S.clock < 1e-9) { S.clock = next; hourTick(next); }
    }
  }
  let last = performance.now(), frameN = 0, lastSave = 0, lastLive = 0;
  function frame(now) {
    const dt = Math.min(0.6, (now - last) / 1000); last = now; frameN++;
    if (S.running && !document.hidden && !Story.open && !DR) advance(dt * SPEED);
    moveTrucks();
    if (now - lastLive > 700) { lastLive = now; refreshLive(); }
    if (now - lastSave > 4000) { lastSave = now; save(); }
    requestAnimationFrame(frame);
  }

  function countTo(el, to, fmt) {
    if (!el) return;
    const from = el._v == null ? to : el._v; el._v = to;
    if (Math.abs(from - to) < 1e-6) { el.textContent = fmt(to); return; }
    const t0 = performance.now(), run = n => { const k = Math.min(1, (n - t0) / 650), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1 && el._v === to) requestAnimationFrame(run); };
    requestAnimationFrame(run);
  }
  function refreshLive() {
    $("#clock").textContent = when(S.clock);
    const paused = !S.running; $("#pulse").classList.toggle("off", paused); $("#pp").innerHTML = paused ? IC.play : IC.pause; $("#pp").setAttribute("aria-label", paused ? "Start time" : "Pause time");
    const k = kpis(), badge = openEx().length, nb = $("#nb");
    if (nb) { nb.textContent = badge; nb.style.display = badge ? "grid" : "none"; }
    const arc = $("#arc");
    if (arc) { const f = Math.max(0, Math.min(1, (k.otif - 70) / 30)); arc.style.strokeDashoffset = 314.16 * (1 - f); countTo($("#mv"), k.otif, v => v.toFixed(1) + "%"); countTo($("#s1"), k.moving, v => Math.round(v)); countTo($("#s2"), k.money, v => "₹" + v.toFixed(1) + " Cr"); countTo($("#s3"), S.autoCount, v => Math.round(v)); countTo($("#s4"), badge, v => Math.round(v)); }
    const fd = $("#feed");
    if (fd) { const have = new Set($$(".it", fd).map(e => e.dataset.id)); S.feed.slice(0, 12).reverse().forEach(f => { if (!have.has(f.id)) fd.insertAdjacentHTML("afterbegin", feedItem(f)); }); $$(".it", fd).slice(12).forEach(e => e.remove()); }
    if (route()[0] === "track" && frameN % 2 === 0) { const t = $("#tlist"); if (t && !t.matches(":hover")) t.innerHTML = truckList(); }
    if (route()[0] === "needs" && !$("#ask") && badge) render();
  }
  const FEEDI = { good: [IC.check("#077466"), "#DDF6F1"], alert: [IC.bang("#BE2B30"), "#FFE8E8"], truck: [IC.truck("#1463D6"), "#E6F0FF"], auto: [IC.spark("#5B36A8"), "#EFE8FF"], you: [IC.check("#fff"), "#1463D6"] };
  const feedItem = f => `<div class="it" data-id="${f.id}"><span class="dot" style="background:${FEEDI[f.kind][1]}">${FEEDI[f.kind][0]}</span><div>${esc(f.text)}<small>${when(f.t)}</small></div></div>`;
  function toast(m) { const t = $("#toast"); t.textContent = m; t.style.display = "block"; clearTimeout(toast.t); toast.t = setTimeout(() => { t.style.display = "none"; }, 3600); }
  function confetti() { const c = $("#confetti"); c.innerHTML = Array.from({ length: 46 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${CAT[i % 4]};animation-delay:${Math.random() * 0.5}s"></i>`).join(""); setTimeout(() => { c.innerHTML = ""; }, 2700); }

  // ---------------------------------------------------------------- map
  let MAP = null;
  function mapHTML() { return `<div class="mapwrap" id="map"></div><div class="key"><span><i style="background:#1463D6"></i>On track</span><span><i style="background:#F2A20C"></i>At risk</span><span><i style="background:#E5484D"></i>Likely late</span></div>`; }
  function mountMap() {
    const el = $("#map"); MAP = null; if (!el) return;
    const I = window.INDIA_MAP;
    el.innerHTML = `<svg viewBox="${I.viewBox}" role="img" aria-label="Map of India with live trucks"><g fill="#E2ECFA" stroke="#fff" stroke-width="1.2">${I.paths.map(p => `<path id="st-${p[0]}" d="${p[1]}"/>`).join("")}</g><g id="rt"></g><g id="pn"></g><g id="tk"></g></svg>`;
    const svg = el.querySelector("svg"), pos = {}, ns = "http://www.w3.org/2000/svg";
    S.nodes.forEach(n => {
      const b = svg.querySelector("#st-" + n.st).getBBox(); pos[n.id] = [b.x + b.width * n.fx, b.y + b.height * n.fy];
      const [x, y] = pos[n.id], pn = svg.querySelector("#pn");
      const c = document.createElementNS(ns, "circle"); c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", n.kind === "Plant" ? 9 : 6); c.setAttribute("fill", n.kind === "Plant" ? "#0B3F91" : "#7FA6DF"); c.setAttribute("stroke", "#fff"); c.setAttribute("stroke-width", 2); c.setAttribute("data-tip", `${n.label}: ${num(n.stock)} KT of steel`); pn.appendChild(c);
      const t = document.createElementNS(ns, "text"); t.setAttribute("x", x + n.dx); t.setAttribute("y", y + n.dy); t.setAttribute("font-size", 17); t.setAttribute("font-weight", 800); t.setAttribute("fill", "#22324D"); if (n.anchor) t.setAttribute("text-anchor", n.anchor); t.textContent = n.label; pn.appendChild(t);
    });
    MAP = { svg, pos, lanes: {}, mk: {}, ns };
  }
  function laneOf(o) {
    const k = o.origin + "-" + o.dest; let l = MAP.lanes[k];
    if (!l) {
      const a = MAP.pos[o.origin], b = MAP.pos[o.dest], d = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.18, c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - d];
      const e = document.createElementNS(MAP.ns, "path"); e.setAttribute("d", `M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`); e.setAttribute("class", "lane"); MAP.svg.querySelector("#rt").appendChild(e);
      l = MAP.lanes[k] = { a, b, c };
    }
    return l;
  }
  function moveTrucks() {
    if (!MAP) return;
    if (!document.body.contains(MAP.svg)) { MAP = null; return; }
    const seen = {};
    S.orders.forEach(o => {
      if (o.confirm == null || S.clock < o.dispatch || S.clock >= o.eta) return;
      seen[o.id] = 1;
      const l = laneOf(o); let m = MAP.mk[o.id];
      if (!m) {
        const g = document.createElementNS(MAP.ns, "g"); g.setAttribute("class", "trk"); g.setAttribute("data-act", "order"); g.setAttribute("data-id", o.id);
        g.innerHTML = `<circle class="ring" r="15" fill="none" stroke-width="3"/><circle class="bg" r="13" stroke="#fff" stroke-width="2.4"/><g transform="translate(-8.5 -6.5) scale(.95)"><rect x="0" y="1" width="10.5" height="9" rx="1.6" fill="#fff"/><path d="M11.5 4h3l3 3v3h-6z" fill="#fff"/><circle cx="4" cy="11.5" r="2" fill="#fff"/><circle cx="14" cy="11.5" r="2" fill="#fff"/></g>`;
        MAP.svg.querySelector("#tk").appendChild(g); m = MAP.mk[o.id] = { g, t: (S.clock - o.dispatch) / (o.eta - o.dispatch), c: "" };
      }
      const tt = Math.min(1, (S.clock - o.dispatch) / (o.eta - o.dispatch)); m.t += (tt - m.t) * 0.08;
      const u = m.t, x = (1 - u) * (1 - u) * l.a[0] + 2 * (1 - u) * u * l.c[0] + u * u * l.b[0], y = (1 - u) * (1 - u) * l.a[1] + 2 * (1 - u) * u * l.c[1] + u * u * l.b[1];
      m.g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      if (frameN % 40 === 0 || !m.c) {
        const v = view(o), col = v.p >= 0.75 ? "#E5484D" : v.p >= 0.5 ? "#F2A20C" : "#1463D6";
        if (col !== m.c) { m.c = col; m.g.querySelector(".bg").setAttribute("fill", col); const r = m.g.querySelector(".ring"); r.setAttribute("stroke", col); r.style.display = v.p >= 0.5 ? "" : "none"; }
        m.g.setAttribute("data-tip", `${o.customer} to ${nodeName(o.dest)}, arriving ${when(o.eta)}`);
      }
    });
    Object.keys(MAP.mk).forEach(id => { if (!seen[id]) { MAP.mk[id].g.remove(); delete MAP.mk[id]; } });
  }

  // ---------------------------------------------------------------- split the steel (shared with mission 1)
  function silosHTML(s) { return `<div class="silos">${s.customers.map((c, i) => `<div class="silo" data-i="${i}"><div class="tank"><div class="f mill" style="background:${CAT[i % 4]}"></div><div class="f net" style="background:${CAT[i % 4]};opacity:.55"></div><div class="num">0</div></div><h4>${esc(c.name)}</h4><div class="why">${WHY[c.tier]}</div><span class="pill plain rule" style="visibility:hidden">-</span></div>`).join("")}</div>`; }
  function setSilos(root, s, rows, shown) {
    const max = Math.max(...s.customers.map(c => c.need), 1);
    $$(".silo", root).forEach((el, i) => {
      const c = s.customers[i], r = rows[i], on = !shown || shown.has(i), need = c.need || 1;
      const mill = on ? r.mill : 0, net = on ? r.net : 0;
      $(".tank", el).style.height = (70 + Math.round((c.need / max) * 120)) + "px";
      $(".mill", el).style.height = (mill / need) * 100 + "%";
      $(".net", el).style.height = (net / need) * 100 + "%"; $(".net", el).style.bottom = (mill / need) * 100 + "%";
      $(".num", el).textContent = (mill + net).toFixed(1) + " / " + c.need;
      const p = $(".rule", el), rule = on ? PLAIN_RULE[r.rule] || "" : ""; p.style.visibility = rule ? "visible" : "hidden"; p.textContent = r.lineStop && on ? "Line stops" : rule; p.className = "pill rule " + (r.lineStop && on ? "bad" : "blue");
    });
  }
  const PLAIN_RULE = { Protect: "Goes first", "Re-source": "Uses nearby stock", "Re-time": "Can wait a little", Rank: "Gets what's left" };
  let timers = [];
  const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  function playRule(root, s, res, opts) {
    clearTimers();
    const rows = res.final.rows, say = $(".say", root), money = $(".money", root);
    const names = f => rows.filter(f).map(r => r.c.name).join(" and ");
    const seq = [["Protect", () => `${names(r => r.rule === "Protect")} can't wait. Without this steel the line stops, so it goes first.`], ["Re-source", () => { const r = rows.find(x => x.rule === "Re-source"); return `Before cutting anyone, check nearby stock. ${r.c.name} gets ${r.net.toFixed(1)} KT from a service centre.`; }], ["Re-time", () => `${names(r => r.rule === "Re-time")} has enough steel to wait a few days, so it goes next.`], ["Rank", () => `What's left goes to the most valuable order. ${names(r => r.rule === "Rank")} gets what remains, and the rest can follow later.`]].filter(st => rows.some(r => r.rule === st[0]));
    const shown = new Set(); let total = 0; setSilos(root, s, rows, shown); if (money) { money._v = 0; money.textContent = cr(0); }
    const speak = (n, t) => { say.innerHTML = `<b class="st">${n}</b><div>${t}</div>`; say.classList.remove("pop"); void say.offsetWidth; say.classList.add("pop"); };
    speak("…", "Watch how VACHAN splits the steel.");
    seq.forEach((st, k) => later(() => {
      speak(k + 1, st[1]());
      rows.forEach((r, i) => { if (r.rule === st[0]) { shown.add(i); total += r.value; } });
      setSilos(root, s, rows, shown);
      if (money) countTo(money, total - (k === seq.length - 1 ? res.final.stop : 0), v => cr(v));
    }, 500 + k * 1900));
    later(() => { speak(seq.length + 1, res.extend ? `Last check: making extra steel earns ${cr(res.stretch.gain)} and costs ${cr(res.stretch.cost)}. It's worth it.` : `Last check: should we make extra steel? It would cost ${cr(res.stretch.cost)} to earn ${cr(res.stretch.gain)}. No.`); if (opts && opts.done) opts.done(); }, 500 + seq.length * 1900);
  }

  // ---------------------------------------------------------------- screens
  const MINFO = {
    line: { t: "Keep the car line running", d: "A carmaker has 2 days of steel left, and there isn't enough for everyone.", art: () => artLine(""), min: "1 min" },
    pipe: { t: "Find the pipe maker's steel", d: "30 KT behind, split across half-empty trucks, and no one knows when it lands.", art: () => artRoad(""), min: "1 min" },
    stock: { t: "Rescue the steel nobody ordered", d: "Steel is ageing in yards and about to be sold cheap.", art: () => artYard(""), min: "1 min" }
  };
  const VIEWS = {
    today() {
      const done = Object.values(S.missions).filter(Boolean).length;
      return `<div class="view"><div class="head"><h1>Good morning. Here's how your promises are doing.</h1><p>Every truck below is moving right now. VACHAN watches them all and only asks you when it matters.</p></div>
      <div class="grid c-home">
        <section class="card meter"><h3>Promises kept</h3>
          <svg viewBox="0 0 240 142" role="img" aria-label="Share of orders delivered on time and in full"><path d="M20 122a100 100 0 0 1 200 0" fill="none" stroke="#E8EEF7" stroke-width="20" stroke-linecap="round"/><path id="arc" class="arc" d="M20 122a100 100 0 0 1 200 0" fill="none" stroke="#1463D6" stroke-width="20" stroke-linecap="round" stroke-dasharray="314.16" stroke-dashoffset="314.16"/>
          <g font-size="12.5" font-weight="800" fill="#52607A"><text x="20" y="141" text-anchor="middle">70</text><text x="220" y="141" text-anchor="middle">100</text></g><path d="M200.4 86.3L226 74.9" stroke="#0FA08E" stroke-width="4" stroke-linecap="round"/><text x="240" y="66" text-anchor="end" font-size="12.5" font-weight="900" fill="#077466">Goal 96</text><text id="mv" class="big" x="120" y="112" text-anchor="middle">-</text></svg>
          <div class="mute" style="margin-top:2px" data-tip="Share of orders that arrive on time and complete. The industry term is OTIF.">orders arriving on time and complete</div>
          <div class="stats"><div class="stat"><b id="s1">-</b><span>on the road</span></div><div class="stat"><b id="s2">-</b><span>at risk</span></div><div class="stat"><b id="s4">-</b><span>need you</span></div><div class="stat"><b id="s3">-</b><span>handled for you</span></div></div>
          <a class="btn" style="margin-top:14px;width:100%" href="#needs">See what needs you</a></section>
        <section class="card"><h3>Live right now</h3>${mapHTML()}</section>
        <section class="card"><h3>What's happening</h3><div class="feed" id="feed"></div></section>
      </div>
      <div class="row spread" style="margin:24px 0 12px"><div><h2>Friday went badly. Can you fix it?</h2><div class="sub">Three short missions show how VACHAN works. No experience needed.</div></div><span class="pill blue" style="font-size:15px">${done} of 3 done</span></div>
      <div class="grid c3">${Object.keys(MINFO).map(k => `<button class="mission" data-act="mission" data-m="${k}"><div class="pic">${MINFO[k].art()}</div>${S.missions[k] ? `<span class="pill good tick">Done</span>` : ""}<h3>${MINFO[k].t}</h3><p>${MINFO[k].d}</p><div class="go">${S.missions[k] ? "Play again" : "Start, about " + MINFO[k].min} ›</div></button>`).join("")}</div></div>`;
    },
    needs() {
      const ex = openEx(), auto = Object.values(S.alerts).filter(a => a.status === "auto").length, total = ex.length + Object.values(S.alerts).filter(a => a.status === "accepted" || a.status === "overridden").length, doneN = total - ex.length;
      if (!ex.length) return `<div class="view"><div class="head"><h1>You're all caught up.</h1><p>VACHAN will bring you the next one as soon as something needs a person.</p></div><div class="card allclear"><div class="bob" style="display:inline-block">${truckArt("#0FA08E", 130)}</div><h2 style="margin-top:12px">Nothing needs you right now</h2><p class="sub">${auto} smaller problems were handled automatically.</p><a class="btn" style="margin-top:14px" href="#today">Back to today</a></div></div>`;
      const e = ex[0], o = e.v.o, after = previewP(o, e.pb);
      return `<div class="view"><div class="head" style="text-align:center"><h1>One decision at a time</h1><p style="margin:4px auto 0">VACHAN already handled ${auto} small problems. ${ex.length === 1 ? "This one needs" : "These " + ex.length + " need"} a person.</p></div>
      <div class="stackwrap"><div class="progress" style="margin-bottom:16px"><i style="width:${total ? (doneN / total) * 100 : 0}%"></i></div>
      <div style="position:relative">${ex.length > 2 ? `<div class="stackbg b2"></div>` : ""}${ex.length > 1 ? `<div class="stackbg"></div>` : ""}
      <article class="ask" id="ask"><div class="bn"><div class="row spread"><span class="mute">${esc(o.grade)}, ${num(o.t)} tonnes to ${nodeName(o.dest)}</span>${riskPill(e.v.p)}</div><h2 style="font-size:25px;margin-top:6px;font-weight:900">${esc(headline(e.v))}</h2></div>
      <div class="bd"><div class="fix"><span class="ic">${IC[e.pb.ic]}</span><div><b>VACHAN suggests: ${esc(e.pb.key)}</b><div class="sub">${esc(e.pb.text)}</div></div></div>
      <div class="delta"><span>If you say yes:</span><span class="pill bad">${Math.round(e.v.p * 100)}% chance of being late</span><span>→</span><span class="pill good">${Math.round(after * 100)}%</span><span class="mute" style="margin-left:auto">${cr(e.v.money)} at stake</span></div>
      ${UI.reasoning ? `<div><b>Why not?</b> <span class="sub">This helps VACHAN learn.</span><div class="row" style="margin-top:8px">${REASONS.map(r => `<button class="chip" data-act="reason" data-id="${o.id}" data-r="${esc(r)}">${esc(r)}</button>`).join("")}<button class="btn ghost sm" data-act="cancelreason">Cancel</button></div></div>` : `<div class="row"><button class="btn green" style="flex:1" data-act="yes" data-id="${o.id}">Yes, do it</button><button class="btn soft" data-act="no">I'll handle it</button><button class="btn ghost" data-act="order" data-id="${o.id}">Tell me more</button></div>`}
      </div></article></div></div></div>`;
    },
    track() {
      return `<div class="view"><div class="head"><h1>Where's my steel?</h1><p>Tap any truck to see its story. If a truck's GPS goes quiet, VACHAN finds it another way.</p></div>
      <div class="grid c-track"><section class="card">${mapHTML()}</section><section class="card flush"><div style="padding:14px"><input class="search" placeholder="Search a customer or order" value="${esc(UI.tq)}" data-input="tq" aria-label="Search"></div><div class="tlist" id="tlist">${truckList()}</div></section></div></div>`;
    },
    split() {
      const s = S.alloc, sl = (p, l, mn, mx, st, v, f) => `<label class="sl"><span>${l}</span><output data-out="${p}">${f(v)}</output><input type="range" min="${mn}" max="${mx}" step="${st}" value="${v}" data-input="alloc" data-path="${p}" aria-label="${l}"></label>`;
      const inp = (path, val, step) => `<input class="cell" type="number" step="${step || 0.5}" min="0" value="${val}" data-input="alloc" data-path="${path}" aria-label="${path}">`;
      return `<div class="view"><div class="head"><h1>Split the steel</h1><p>There's less steel than customers want. Change the situation and see how the decision changes.</p></div>
      <div class="grid c-split"><div class="grid" style="align-content:start"><section class="card" id="splitroot"><div class="row spread" style="margin-bottom:12px"><h3>Who gets what</h3><div class="row"><span class="sub">Value earned</span><b class="money" style="font-size:24px;font-weight:900;color:var(--blue2)">-</b><button class="btn soft sm" data-act="playrule">Replay</button></div></div><div class="say"><b class="st">?</b><div>Press Replay to watch the rule step by step.</div></div>${silosHTML(s)}</section>
        <section class="card"><h3>Other ways to split it</h3><div id="ways"></div></section></div>
      <div class="grid" style="align-content:start"><section class="card"><h3>Try "what if"</h3>
        <div class="row" style="margin-bottom:12px">${[["Original", "base"], ["Nearby stock unusable", "spc"], ["OEM A needs 10.5", "a105"]].map(p => `<button class="chip" data-act="preset" data-p="${p[1]}">${p[0]}</button>`).join("")}</div>
        ${sl("customers.0.need", "OEM A needs", 0, 12, 0.1, s.customers[0].need, fkt)}${sl("campaign", "Steel we can make", 4, 16, 0.5, s.campaign, fkt)}${sl("network.kt", "Stock nearby", 0, 3, 0.1, s.network.kt, fkt)}${sl("customers.3.margin", "Profit on export, per tonne", 5000, 45000, 500, s.customers[3].margin, frs)}
        <details><summary>All the numbers</summary><div class="wide" style="margin-top:10px"><table class="tbl"><tr><th></th><th class="r">Need KT</th><th class="r">₹/t</th><th class="r">Days left</th><th>Type</th></tr>${s.customers.map((c, i) => `<tr><td><b>${esc(c.name)}</b></td><td class="r">${inp(`customers.${i}.need`, c.need, 0.1)}</td><td class="r">${inp(`customers.${i}.margin`, c.margin, 500)}</td><td class="r">${inp(`customers.${i}.cover`, c.cover, 1)}</td><td><select class="cell" data-input="alloc" data-path="customers.${i}.tier" aria-label="Type">${Object.keys(TIER).map(t => `<option value="${t}" ${c.tier === t ? "selected" : ""}>${TIER[t]}</option>`).join("")}</select></td></tr>`).join("")}</table></div><div class="fields" style="margin-top:10px"><label>Extra KT ${inp("extension", s.extension)}</label><label>Displaced ₹/t ${inp("displaced", s.displaced, 500)}</label><label>Changeover ₹ Cr ${inp("changeover", s.changeover)}</label><label>Line stop ₹ Cr ${inp("stopCr", s.stopCr)}</label></div></details></section>
        <section class="card"><h3>Should we make extra steel?</h3><div id="verdict"></div></section>
        <section class="card"><h3>Who can sign this off?</h3><div id="who"></div><div class="row" style="margin-top:12px"><button class="btn green" style="flex:1" data-act="alloc-approve">Approve</button><button class="btn soft" data-act="override" data-id="ALLOC">Change it</button></div><div id="stamp" style="margin-top:8px"></div></section></div></div></div>`;
    },
    worth() {
      const a = S.value, sl = (k, l, mn, mx, st, f) => `<label class="sl"><span>${l}</span><output id="o_${k}">${SF[f](a[k])}</output><input type="range" min="${mn}" max="${mx}" step="${st}" value="${a[k]}" data-input="value" data-key="${k}" data-f="${f}" aria-label="${l}"></label>`;
      return `<div class="view"><div class="head row spread"><div><h1>Is it worth it?</h1><p>Drag the sliders. If the plan only works when everything goes right, you'll see it here.</p></div><div class="row">${[["LOW", "Cautious"], ["BASE", "Expected"], ["HIGH", "Ambitious"]].map(c => `<button class="chip ${S.valueMode === c[0] ? "on" : ""}" data-act="vcase" data-c="${c[0]}">${c[1]}</button>`).join("")}</div></div>
      <div class="bignums"><div class="bign a"><span>Extra profit every year</span><b id="w1">-</b></div><div class="bign b"><span>Cash freed up, once</span><b id="w2">-</b></div><div class="bign c"><span>Total value over 5 years (NPV)</span><b id="w3">-</b></div></div>
      <div class="grid c-split mt"><div class="grid" style="align-content:start"><section class="card"><h3>Where the yearly profit comes from, ₹ Cr</h3><div id="lev"></div></section><section class="card"><h3>Money in and out each year, ₹ Cr</h3><div class="cash" id="cash">${M.YEARS.map((y, i) => `<div class="c"><b data-c="${i}">0</b><i data-b="${i}"></i></div>`).join("")}</div><div class="cashx">${M.YEARS.map(y => `<span>${y}</span>`).join("")}</div><p class="sub" style="margin-top:10px">Pays for itself in <b id="pb">-</b>, even without counting the one-time cash.</p></section></div>
      <section class="card"><h3>What if we're wrong?</h3>${sl("inv_days", "Days of stock we cut", 0, 10, 0.5, "d")}${sl("alloc_uplift", "Extra ₹ on each scarce tonne", 0, 1500, 50, "n")}${sl("frag_share", "Orders in half-empty trucks", 0, 0.3, 0.01, "p")}${sl("capex", "Cost to build, ₹ Cr", 50, 300, 10, "n")}
      <details><summary>More assumptions</summary><div style="margin-top:12px">${sl("consol", "Freight premium we remove", 0, 1, 0.05, "p")}${sl("constr_share", "Share of steel that is scarce", 0, 0.2, 0.01, "p")}${sl("mix_shift", "Volume moved to better customers", 0, 0.02, 0.0005, "p2")}${sl("stop_events", "Line stops a year", 0, 15, 1, "n")}${sl("age_flow", "Tonnes ageing a year", 0, 100000, 5000, "n")}${sl("age_prevent", "Ageing we prevent", 0, 1, 0.05, "p")}${sl("fte_free", "Planner time freed", 0, 0.5, 0.05, "p")}${sl("run", "Yearly running cost, ₹ Cr", 10, 80, 5, "n")}</div></details>
      <details><summary>What changes the answer most</summary><div id="torn" style="margin-top:10px"></div></details></section></div></div>`;
    },
    more() {
      const sub = route()[1] && MORE[route()[1]] ? route()[1] : "orders";
      return `<div class="view"><div class="head"><h1>Behind the scenes</h1><p>The detail, for when you want it.</p></div><div class="tabs">${Object.keys(MORE).map(k => `<a class="chip ${k === sub ? "on" : ""}" style="text-decoration:none" href="#more/${k}">${MORE[k][0]}</a>`).join("")}</div>${MORE[sub][1]()}</div>`;
    }
  };
  const fkt = v => (+v).toFixed(1) + " KT", frs = v => "₹" + num(v);
  const SF = { d: v => v + " days", n: v => num(v), p: v => Math.round(v * 100) + "%", p2: v => (v * 100).toFixed(2) + "%" };
  function truckList() {
    const q = UI.tq.toLowerCase();
    const list = S.orders.map(view).filter(v => v.moving && (!q || (v.o.customer + " " + v.o.id).toLowerCase().includes(q))).sort((a, b) => b.p - a.p);
    return list.map(v => { const col = v.p >= 0.75 ? "#E5484D" : v.p >= 0.5 ? "#F2A20C" : "#1463D6", pct = Math.min(100, ((S.clock - v.o.dispatch) / (v.o.eta - v.o.dispatch)) * 100); return `<button class="tl" data-act="order" data-id="${v.o.id}">${IC.truck(col)}<div>${esc(v.o.customer)} <span class="mute">to ${nodeName(v.o.dest)}</span><div class="bar2"><i style="width:${pct}%;background:${col}"></i></div><small>Arrives ${when(v.o.eta)}</small></div>${riskPill(v.p)}</button>`; }).join("") || `<div style="padding:16px" class="sub">No trucks match.</div>`;
  }
  function gatePass(g) { return g.dir > 0 ? g.v >= g.t : g.v <= g.t; }
  function gateResult(p) { const miss = p.gates.filter(g => !gatePass(g)).length; if (p.week < 16) return { cls: "warn", text: `Still running: week ${p.week} of 16.` }; if (miss) return { cls: "bad", text: `Not yet. ${miss} target${miss > 1 ? "s" : ""} missed, so fix it and run 8 more weeks.` }; if (p.months < 2) return { cls: "warn", text: "All targets met. Hold until that lasts two months." }; return { cls: "good", text: "Go. All targets met two months running, so roll it out." }; }
  const MORE = {
    orders: ["All orders", () => { let l = S.orders.map(view); const q = UI.q.toLowerCase(); if (q) l = l.filter(v => (v.o.id + " " + v.o.customer + " " + v.o.grade).toLowerCase().includes(q)); l.sort((a, b) => b.p - a.p); return `<input class="search" style="margin-bottom:12px" id="q" placeholder="Search an order, customer or steel grade" value="${esc(UI.q)}" data-input="q" aria-label="Search"><section class="card flush"><div class="scroll wide" id="otable">${ordersTable(l)}</div></section>`; }],
    decisions: ["Who decides", () => { const dot = (d, c) => d.cur === c ? `<span title="Now" style="display:inline-block;width:16px;height:16px;border-radius:50%;background:var(--blue)"></span>` : d.fy29 === c ? `<span class="mute">goal</span>` : ""; return `<p class="sub" style="margin-bottom:12px">AI suggests, a named person commits. A decision goes automatic only after passing five tests. Tap one to try.</p><section class="card flush"><div class="wide"><table class="tbl"><tr><th>Decision</th>${CLASSES.map(c => `<th class="c">${c}</th>`).join("")}<th>Status</th></tr>${S.decisions.map(d => { const t = M.graduationTests(d), pass = t.every(x => x.ok); return `<tr class="click" data-act="decision" data-id="${d.id}"><td>${esc(d.name)}</td>${[0, 1, 2, 3].map(c => `<td class="c">${dot(d, c)}</td>`).join("")}<td>${d.cur === 1 ? (pass ? `<span class="pill good">Ready</span>` : `<span class="pill plain">${t.filter(x => x.ok).length} of 5 tests</span>`) : d.cur === 0 ? `<span class="pill blue">Automatic</span>` : `<span class="pill plain">Stays human</span>`}</td></tr>`; }).join("")}</table></div></section>`; }],
    pilots: ["Pilot results", () => `<div class="grid c2">${S.pilots.map((p, pi) => { const r = gateResult(p); return `<section class="card"><h3>${esc(p.name)}: ${esc(p.what)}</h3><p class="sub" style="margin-bottom:8px">${esc(p.scope)}. Compared with: ${esc(p.control.toLowerCase())}.</p>${p.gates.map((g, gi) => `<div class="gate"><span>${esc(g.l)} <span class="mute">target ${g.dir > 0 ? "≥" : "≤"} ${g.t}${g.u}</span></span><input class="cell" type="number" step="0.5" value="${g.v}" data-input="pilot" data-path="${pi}.gates.${gi}.v" aria-label="${esc(g.l)}"><span id="g${pi}_${gi}">${gatePill(g)}</span></div>`).join("")}<div class="row" style="margin:10px 0"><label class="row sub">Week <input class="cell" type="number" min="0" max="16" value="${p.week}" data-input="pilot" data-path="${pi}.week" aria-label="Week"></label><label class="row sub">Months all met <input class="cell" type="number" min="0" max="6" value="${p.months}" data-input="pilot" data-path="${pi}.months" aria-label="Months"></label></div><div id="pv${pi}" class="verdict ${r.cls}">${r.text}</div></section>`; }).join("")}</div>`],
    phone: ["Customer's phone", () => { const list = S.orders.filter(o => o.confirm != null); if (!UI.customer || !list.find(o => o.id === UI.customer)) UI.customer = list[0].id; return `<div style="max-width:380px;margin:0 auto"><select class="search" data-input="customer" aria-label="Order">${list.map(x => `<option value="${x.id}" ${x.id === UI.customer ? "selected" : ""}>${x.customer}, ${x.id}</option>`).join("")}</select><div style="margin-top:14px">${phone(view(S.orders.find(o => o.id === UI.customer)))}</div></div>`; }],
    log: ["Decision log", () => `<div class="row spread" style="margin-bottom:12px"><p class="sub">Every decision, with who, when and why.</p><button class="btn soft sm" data-act="csv">Download</button></div><section class="card flush"><div class="scroll wide"><table class="tbl"><tr><th>When</th><th>Who</th><th>What</th><th>Why</th></tr>${S.audit.map(a => `<tr><td style="white-space:nowrap">${when(a.t)}</td><td>${esc(a.who)}</td><td>${esc(a.what)}</td><td class="sub">${esc(a.why)}</td></tr>`).join("") || `<tr><td colspan="4">Nothing yet.</td></tr>`}</table></div></section>`]
  };
  const gatePill = g => gatePass(g) ? `<span class="pill good">Met</span>` : `<span class="pill bad">Missed</span>`;
  function ordersTable(l) { return `<table class="tbl"><tr><th>Customer</th><th>Steel</th><th class="r">Tonnes</th><th>Status</th><th>Promised</th><th>Expected</th><th></th></tr>${l.map(v => `<tr class="click" data-act="order" data-id="${v.o.id}"><td><b>${esc(v.o.customer)}</b><div class="mute">${v.o.id}</div></td><td>${esc(v.o.grade)}</td><td class="r">${num(v.o.t)}</td><td>${v.stage}</td><td>${v.o.confirm == null ? "-" : when(v.o.promise)}</td><td>${when(v.o.eta)}</td><td>${v.o.confirm == null ? `<span class="pill plain">Needs a date</span>` : v.done ? `<span class="pill ${v.onTime ? "good" : "bad"}">${v.onTime ? "Arrived on time" : "Arrived late"}</span>` : riskPill(v.p)}</td></tr>`).join("")}</table>`; }
  function phone(v) {
    const o = v.o, idx = { Scheduled: 0, Made: 1, "On the road": 3, Delivered: 4 }[v.stage];
    const st = [["Date confirmed", when(o.confirm)], ["Steel made", when(o.produced)], ["Left the plant", when(o.dispatch)], ["On the way", v.moving ? "Last seen via " + (o.mode === "Rail" ? "rail status" : v.signal.label) : ""], ["Delivered", when(o.eta)]];
    return `<div style="border:9px solid #1B2433;border-radius:30px;overflow:hidden;background:#fff"><div style="background:var(--blue);color:#fff;padding:20px 18px 16px"><div style="opacity:.85;font-size:14px">${num(o.t)} t ${esc(o.grade)}</div><div style="font-size:15px;margin-top:8px">${v.done ? "Delivered" : "Arriving"}</div><div style="font-size:28px;font-weight:900">${when(o.eta)}</div></div><div style="padding:14px 18px 18px">${v.p >= 0.5 ? `<div class="verdict warn" style="font-size:14.5px;margin-bottom:10px">This may be later than promised. Your account owner is already on it.</div>` : ""}<ul class="steps">${st.map(([n, t], i) => `<li class="${i < idx || v.done ? "done" : i === idx ? "now" : ""}"><i></i><div>${n}<small>${esc(t)}</small></div></li>`).join("")}</ul></div></div>`;
  }

  // ---------------------------------------------------------------- live parts of split and worth
  function updateSplit(noFill) {
    const root = $("#splitroot"); if (!root) return;
    const s = S.alloc, r = M.solve(s), ours = r.options.find(o => o.ours);
    if (!noFill) setSilos(root, s, r.final.rows);
    countTo($(".money", root), ours.value, v => cr(v));
    const NAMES = { "Pro-rata share": "Everyone gets an equal share", "Extend campaign": "Make more steel", "Rank by margin only": "Highest profit first", "4R rule": "VACHAN's rule" };
    const mx = Math.max(...r.options.map(o => Math.abs(o.value)), 1), w = $("#ways");
    if (!w.children.length) w.innerHTML = r.options.map(o => `<div class="hb ${o.ours ? "me" : ""}"><span>${NAMES[o.name]}</span><div class="tr"><i style="background:${o.ours ? "#1463D6" : "#B7C9E6"}"></i></div><b></b></div>`).join("");
    r.options.forEach((o, i) => { const h = w.children[i]; requestAnimationFrame(() => { $("i", h).style.width = Math.max(0, (o.value / mx) * 100) + "%"; }); $("b", h).textContent = "₹" + o.value.toFixed(1) + " Cr"; h.setAttribute("data-tip", o.note || ""); });
    const St = r.stretch;
    $("#verdict").innerHTML = `<div class="verdict ${r.extend ? "warn" : "good"}">${r.extend ? "Yes, make more." : "No, don't."} It would cost ${cr(St.cost)} and earn ${cr(St.gain)}.</div>`;
    $("#who").innerHTML = r.escalate.length ? `<div class="verdict warn">This one goes to the weekly Commit Room: ${esc(r.escalate.join("; ").toLowerCase())}.</div>` : `<div class="verdict good">The Promise Owner can approve this alone.</div>`;
    $("#stamp").innerHTML = S.allocDecision ? `<span class="pill ${S.allocDecision.type === "Approved" ? "good" : "warn"}">${esc(S.allocDecision.type)}, ${when(S.allocDecision.at)}</span>` : "";
  }
  function updateWorth() {
    if (!$("#w1")) return;
    const C = M.cashflow(S.value), L = C.levers;
    countTo($("#w1"), L.recurring, v => "₹" + num(v) + " Cr"); countTo($("#w2"), L.oneTime, v => "₹" + num(v) + " Cr"); countTo($("#w3"), C.npv, v => "₹" + num(v) + " Cr");
    const items = [["Fewer half-empty trucks", L.logistics], ["Scarce steel to the right customer", L.allocation], ["Better customers, fewer line stops", L.mix], ["Less steel sold off cheap", L.highAge], ["Planners freed up", L.productivity]], mx = Math.max(...items.map(i => i[1]), 1), lv = $("#lev");
    if (!lv.children.length) lv.innerHTML = items.map(() => `<div class="hb"><span></span><div class="tr"><i style="background:#1463D6"></i></div><b></b></div>`).join("");
    items.forEach((it, i) => { const h = lv.children[i]; $("span", h).textContent = it[0]; $("b", h).textContent = num(it[1]); requestAnimationFrame(() => { $("i", h).style.width = (it[1] / mx) * 100 + "%"; }); });
    const fm = Math.max(...C.flows.map(Math.abs), 1);
    C.flows.forEach((f, i) => { const b = $(`[data-b="${i}"]`); requestAnimationFrame(() => { b.style.height = Math.max(4, (Math.abs(f) / fm) * 160) + "px"; }); b.style.background = f < 0 ? "#E5484D" : "#1463D6"; $(`[data-c="${i}"]`).textContent = num(f); });
    $("#pb").textContent = C.payback.replace("~", "about ");
    const T = M.tornado(S.value).sort((a, b) => (Math.abs(b[1]) + Math.abs(b[2])) - (Math.abs(a[1]) + Math.abs(a[2]))), tm = Math.max(...T.map(r => Math.max(Math.abs(r[1]), Math.abs(r[2]))), 1);
    $("#torn").innerHTML = T.map(r => `<div style="font-size:14px;margin-bottom:7px"><div class="row spread"><span>${esc(r[0])}</span><span class="mute">${num(r[1])} / +${num(r[2])}</span></div><div style="display:flex;height:9px"><div style="flex:1;display:flex;justify-content:flex-end"><i style="display:block;background:#B7C9E6;border-radius:5px 0 0 5px;width:${(Math.abs(r[1]) / tm) * 100}%"></i></div><div style="flex:1"><i style="display:block;height:100%;background:#1463D6;border-radius:0 5px 5px 0;width:${(Math.abs(r[2]) / tm) * 100}%"></i></div></div></div>`).join("");
  }

  // ---------------------------------------------------------------- drawers
  function openDrawer(type, id) { DR = { type, id }; drawDrawer(); $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#scrim").classList.add("open"); }
  function closeDrawer() { DR = null; $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); $("#scrim").classList.remove("open"); }
  const shell = (title, sub, body) => `<header><div><h2>${esc(title)}</h2><div class="sub" style="font-size:14.5px">${esc(sub)}</div></div><button class="x" data-act="close" aria-label="Close">×</button></header><div class="body">${body}</div>`;
  function drawDrawer() {
    if (!DR) return; const el = $("#drawer");
    if (DR.type === "order") el.innerHTML = orderDrawer();
    if (DR.type === "override") el.innerHTML = shell("Change the plan", "Tell us why. It helps VACHAN learn.", `<div class="row">${REASONS.map(r => `<button class="chip" data-act="alloc-reason" data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div>`);
    if (DR.type === "decision") el.innerHTML = decisionDrawer();
  }
  function orderDrawer() {
    const o = S.orders.find(x => x.id === DR.id); if (!o) return shell("Order finished", "", "");
    const v = view(o), a = S.alerts[o.id], pb = playbook(o), open = a && a.status === "open" && !v.done;
    const st = [["Order placed", when(o.created), true], ["Date given", o.confirm != null ? `${hm(o.confirm - o.created)} after the order` : "Waiting", o.confirm != null], ["Steel made", when(o.produced), v.stage === "Made" || v.moving || v.done], ["On the way", o.dispatch != null ? "Left " + when(o.dispatch) : "-", v.moving || v.done], ["Delivered", o.eta != null ? "Expected " + when(o.eta) : "-", v.done]];
    const first = st.findIndex(s => !s[2]);
    return shell(o.customer, `${o.grade}, ${num(o.t)} tonnes, ${nodeName(o.origin)} to ${nodeName(o.dest)}`, `<div class="row" style="margin:6px 0 12px">${o.confirm == null ? `<span class="pill plain">Needs a date</span>` : v.done ? `<span class="pill ${v.onTime ? "good" : "bad"}">${v.onTime ? "Arrived on time" : "Arrived late"}</span>` : riskPill(v.p)}<span class="pill plain">${WHY[o.tier]}</span></div>
      ${o.confirm == null ? `<div class="fix" style="grid-template-columns:1fr"><div><b>This order has no date yet.</b><div class="sub">VACHAN can check stock and the production plan and propose one.</div></div></div><button class="btn" data-act="confirm" data-id="${o.id}">Give it a date</button>` : ""}
      ${open ? `<div class="fix"><span class="ic">${IC[pb.ic]}</span><div><b>${esc(pb.key)}</b><div class="sub">${esc(pb.text)}</div></div></div><button class="btn green" data-act="yes-drawer" data-id="${o.id}">Yes, do it</button>` : ""}
      ${a && a.status !== "open" ? `<p class="sub" style="margin-top:8px">${a.status === "auto" ? "VACHAN handled this automatically." : a.status === "accepted" ? `${esc(a.by)} approved: ${esc(pb.key.toLowerCase())}.` : `${esc(a.by)} chose another way: ${esc(a.reason)}.`}</p>` : ""}
      <h4>The journey</h4><ul class="steps">${st.map((s, i) => `<li class="${s[2] ? "done" : i === first ? "now" : ""}"><i></i><div>${s[0]}<small>${esc(s[1])}</small></div></li>`).join("")}</ul>
      ${v.moving && o.mode === "Road" ? `<h4>How do we know where it is?</h4><p class="sub" style="font-size:14.5px;margin-bottom:8px">Turn a signal off and see VACHAN fall back to the next one.</p><div class="ladder">${M.SIGNALS.map(s => `<label><input type="checkbox" data-input="sig" data-id="${o.id}" data-sig="${s.id}" ${o.sig[s.id] ? "checked" : ""} ${s.id === "call" ? "disabled" : ""}><span>${s.label}${v.signal.id === s.id ? ` <span class="pill blue">in use</span>` : ""}</span><span class="mute">${Math.round(s.confidence * 100)}% sure</span></label>`).join("")}</div>` : ""}
      ${o.confirm != null ? `<h4>What the customer sees</h4>${phone(v)}` : ""}`);
  }
  function decisionDrawer() {
    const d = S.decisions[DR.id], tests = M.graduationTests(d), pass = tests.every(t => t.ok), can = d.cur === 1;
    const inp = (k, st, l) => `<label>${l}<input class="cell" type="number" step="${st}" value="${d[k]}" data-input="dec" data-id="${d.id}" data-k="${k}" aria-label="${l}"></label>`;
    return shell(d.name, "Now: " + CLASSES[d.cur], `${d.cur <= 1 ? `<div class="fields" style="margin-top:6px">${inp("accept", 1, "Advice accepted %")}${inp("weeks", 1, "Weeks running")}${inp("n", 10, "Decisions seen")}${inp("vsHuman", 1, "Vs a human, pts")}${inp("conf", 1, "Data confidence %")}${inp("stake", 1, "At stake, ₹ lakh")}</div><h4>The five tests</h4><div id="dt">${testsList(tests)}</div>` : `<p class="sub">This one stays with a named person. It won't become automatic.</p>`}<div class="row" style="margin-top:14px">${can ? `<button class="btn green" data-act="graduate" ${pass ? "" : "disabled"}>Make it automatic</button>` : ""}${d.cur === 0 && d.fy27 === 1 ? `<button class="btn soft" data-act="demote">Move back to AI suggests</button>` : ""}</div>`);
  }
  const testsList = t => t.map(x => `<div class="gate" style="grid-template-columns:minmax(0,1fr) auto"><span>${esc(x.label)}<span class="mute"> ${esc(x.have)}, needs ${esc(x.need)}</span></span><span class="pill ${x.ok ? "good" : "bad"}">${x.ok ? "Pass" : "Not yet"}</span></div>`).join("");

  // ---------------------------------------------------------------- missions
  const Story = { open: false, id: null, i: 0, tried: {}, ok: false, matched: 0 };
  const story = id => S.orders.find(o => o.story === id);
  const X8 = () => M.solve(M.EXHIBIT8);
  function finishMission(id, msg) {
    S.missions[id] = true; confetti(); save();
    if (Object.values(S.missions).every(Boolean) && !S.allDone) { S.allDone = true; Story.id = "done"; Story.i = 0; drawStory(); return; }
    closeStory(); toast(msg); render();
  }
  const DEMAND = () => `<div style="width:min(520px,90%)"><div class="row spread"><b>Wanted</b><b>13 KT</b></div><div style="display:flex;gap:3px;height:38px;margin:5px 0 14px">${M.EXHIBIT8.customers.map((c, i) => `<div class="bob" style="flex:${c.need};background:${CAT[i]};border-radius:8px;color:#fff;display:grid;place-items:center;font-size:13.5px;font-weight:800;animation-delay:${i * 0.15}s">${c.name}</div>`).join("")}</div><div class="row spread"><b>We can make</b><b>10 KT</b></div><div style="display:flex;gap:3px;height:38px;margin-top:5px"><div style="flex:10;background:#22324D;border-radius:8px"></div><div style="flex:3;border:2px dashed #E5484D;border-radius:8px;color:#BE2B30;display:grid;place-items:center;font-weight:900;font-size:13.5px">3 short</div></div></div>`;
  const STORIES = {
    welcome: { name: "Welcome", steps: [{ bg: "#FFF4DF", art: artRoad(""), title: "Welcome to the steel control room", body: "Every order is a promise to a customer. VACHAN watches them all, spots trouble early, and asks you only when it matters. Everything here is made up, so you can't break anything.", actions: `<button class="btn ghost" data-act="story-close">I'll look around</button><button class="btn" data-act="mission" data-m="line">Start the first mission</button>` }] },
    line: { name: "Keep the car line running", steps: [
      { bg: "#EAF2FF", art: artLine("Only 2 days of steel left"), title: "A carmaker is about to stop its line", body: "OEM A builds cars just in time. If its special steel runs out, the whole assembly line stops, and that costs ₹3 Cr each time.", next: "What's the problem?" },
      { bg: "#F3F6FC", art: DEMAND(), title: "13 wanted. Only 10 can be made.", body: "Four customers want the same steel over the next 14 days. KT means a thousand tonnes.", next: "Let me decide" },
      { title: "Your call. Who gets the steel?", body: "Tap each idea and see what happens.", html: () => { const v = Object.fromEntries(X8().options.map(o => [o.name, o.value])); return [["Pro-rata share", "Give everyone an equal share", "OEM A falls short and its line stops."], ["Rank by margin only", "Highest profit first", "The carmakers are fine, but the export order is lost completely."], ["Extend campaign", "Make 4 KT more", "Extra steel means pausing other products. Expensive."]].map(([k, a, b]) => `<button class="opt ${Story.tried[k] ? "tried" : ""}" data-act="try" data-k="${k}"><span>${a}${Story.tried[k] ? `<small>${b}</small>` : ""}</span>${Story.tried[k] ? `<b style="font-size:20px">₹${v[k].toFixed(1)} Cr</b>` : `<span class="mute">Try it</span>`}</button>`).join(""); }, next: "Show me VACHAN's way" },
      { title: "VACHAN's rule, step by step", html: () => `<div id="rule" style="margin-top:10px"><div class="row spread" style="margin-bottom:8px"><span class="sub">Value earned</span><b class="money" style="font-size:26px;font-weight:900;color:var(--blue2)">₹0</b></div><div class="say"></div>${silosHTML(M.EXHIBIT8)}</div>`, after: el => { const root = $("#rule", el); playRule(root, M.EXHIBIT8, X8(), { done: () => { Story.ok = true; const b = $("#snext"); if (b) b.disabled = false; } }); }, next: "That works", gate: true },
      { bg: "#DDF6F1", art: `<div style="text-align:center"><div class="saved">₹18.07 Cr</div><div class="sub">Both carmakers served in full. Export half now, half later.</div><div style="margin-top:10px" class="pill good">₹1.17 Cr better than the next-best idea</div></div>`, title: "No line stops. And it took minutes, not days.", body: "This used to take a week of calls and senior managers. Now one person approves it, and the reason is logged.", act: "line-approve", next: "Approve the plan" }
    ] },
    pipe: { name: "Find the pipe maker's steel", steps: [
      { bg: "#FFF4DF", art: artRoad("30 KT behind"), title: "A pipe maker is still waiting", body: "Its steel is arriving in small broken lots, trucks are taking longer, and nobody can say when the rest will come.", next: "Find the steel" },
      { bg: "#F3F6FC", art: `<div class="tog">${M.SIGNALS.map(s => `<div class="sig" data-s="${s.id}">${IC.truck("#1463D6")}<span>${s.label}</span><b>${Math.round(s.confidence * 100)}% sure</b></div>`).join("")}</div>`, title: "This truck's GPS has gone quiet", body: "Nobody needs to phone around. VACHAN tries the next-best signal.", next: "Found it", gate: true, after: el => { later(() => { $('[data-s="gps"]', el).classList.add("off"); }, 500); later(() => { $('[data-s="fastag"]', el).classList.add("hit"); }, 1500); later(() => { $(".sbody p", el).textContent = "Spotted at a FASTag toll. VACHAN is 85% sure where it is, and it shows that on screen instead of pretending."; Story.ok = true; $("#snext").disabled = false; }, 2100); } },
      { bg: "#FFF4DF", art: () => `<div class="fleet" id="fleet">${Array.from({ length: 6 }, (_, i) => truckArt(["#F2A20C", "#1463D6"][i % 2], 66)).join("")}</div>`, title: "Six half-empty trucks. That's the real problem.", body: "Half-empty trucks cost up to 25% more and arrive in dribs and drabs. Combine them.", act: "pool", next: "Pool the loads" },
      { bg: "#EAF2FF", art: () => { const o = story("pipe"); return `<div style="display:grid;gap:8px;justify-items:start;padding:18px"><div class="bubble"><b>VACHAN to Pipe Maker:</b> your steel now arrives <b>${when(o.eta)}</b> in 3 full trucks. We'll tell you first if that changes.</div><div class="bubble" style="animation-delay:.5s;background:#DDF6F1;justify-self:end;border-radius:16px 16px 4px 16px">Finally, a date we can plan around.</div></div>`; }, title: "Then tell the customer first", body: "The customer gets a real date before they have to ask.", act: "pipe-done", next: "Done" }
    ] },
    stock: { name: "Rescue the steel nobody ordered", steps: [
      { bg: "#F0EBFF", art: artYard("Sitting for 74 days"), title: "Steel nobody ordered", body: "20 to 25 KT of finished steel is ageing in yards. Sold off in a hurry, it goes for 8 to 12% less.", next: "Find it a home" },
      { title: "Someone already wants this steel", body: "VACHAN matched old stock to open orders. Tap Match.", html: () => `<div style="margin-top:8px">${S.lots.slice(0, 3).map(l => `<div class="lot">${coilArt(l.done ? "#0FA08E" : "#8E9BB0", 40)}<div><b>${l.kt.toFixed(1)} KT of ${esc(l.grade)}</b><div class="mute">${l.age} days old at ${nodeName(l.node)}. ${esc(l.match)} needs this.</div></div>${l.done ? `<span class="pill good">Matched</span>` : `<button class="btn sm" data-act="story-match" data-id="${l.id}">Match</button>`}</div>`).join("")}<div class="row spread" style="margin-top:10px"><span class="sub">Saved from discounting</span><b class="saved" id="sv">${cr(S.recovered)}</b></div></div>`, next: "What about next time?", gate: () => Story.matched > 0 || S.lots.slice(0, 3).every(l => l.done) },
      { bg: "#DDF6F1", art: `<div style="text-align:center;padding:14px"><div style="display:inline-flex;gap:6px" class="bob">${coilArt("#0FA08E", 54)}${coilArt("#1463D6", 54)}${coilArt("#0FA08E", 54)}</div></div>`, title: "Next time, it never gets old", body: "VACHAN checks real orders before steel is made, and flags anything with no buyer. Prevention beats a clearance sale.", act: "stock-done", next: "Done" }
    ] },
    done: { name: "All done", steps: [{ bg: "#DDF6F1", art: `<div style="text-align:center"><div class="bob" style="display:inline-block">${truckArt("#0FA08E", 120)}</div></div>`, title: "Friday, fixed.", body: "A line kept running, a customer got a real date, and old steel found a home. That is VACHAN: one rule, one owner, one view of every tonne.", actions: `<a class="btn soft" href="#worth">Is it worth it?</a><button class="btn" data-act="story-close">Back to the board</button>` }] }
  };
  function openStory(id) { Object.assign(Story, { open: true, id, i: 0, tried: {}, ok: false, matched: 0 }); drawStory(); $("#story").classList.add("open"); }
  function closeStory() { clearTimers(); Story.open = false; Story.id = null; $("#story").classList.remove("open"); $("#story").innerHTML = ""; }
  function drawStory() {
    clearTimers(); Story.ok = false;
    const st = STORIES[Story.id], s = st.steps[Story.i], el = $("#story"), art = typeof s.art === "function" ? s.art() : s.art;
    const gated = s.gate && (typeof s.gate !== "function" || !s.gate());
    el.innerHTML = `<div class="sc"><div class="stop"><div class="dots">${st.steps.length > 1 ? st.steps.map((_, i) => `<i class="${i <= Story.i ? "on" : ""}"></i>`).join("") : ""}</div><button class="x" data-act="story-close" aria-label="Close">×</button></div>${art ? `<div class="sart" style="background:${s.bg || "#F3F6FC"}">${art}</div>` : ""}<div class="sbody"><h2>${esc(s.title)}</h2>${s.body ? `<p>${esc(s.body)}</p>` : ""}${s.html ? s.html() : ""}<div class="sact">${s.actions || `<button class="btn" id="snext" data-act="${s.act || "story-next"}" ${gated ? "disabled" : ""}>${esc(s.next)}</button>`}</div></div></div>`;
    if (s.after) s.after(el);
  }

  // ---------------------------------------------------------------- events
  function preset(p) { const s = clone(M.EXHIBIT8); if (p === "spc") s.network.kt = 0; if (p === "a105") s.customers[0].need = 10.5; S.alloc = s; S.allocDecision = null; render(); }
  function setPath(obj, path, val) { const k = path.split("."); let o = obj; for (let i = 0; i < k.length - 1; i++) o = o[k[i]]; o[k[k.length - 1]] = val; }
  function markTold() { S.orders.forEach(o => { if (view(o).done) o.told = true; }); }

  document.addEventListener("click", ev => {
    const t = ev.target.closest("[data-act]"); if (!t) return;
    const a = t.dataset.act;
    if (a === "playpause") { S.running = !S.running; refreshLive(); }
    if (a === "reset") { if (confirm("Start the whole demo again?")) { S = fresh(); S.welcomed = true; markTold(); syncAlerts(true); seedFeed(); closeDrawer(); UI.reasoning = false; render(); toast("Fresh start."); } }
    if (a === "close") closeDrawer();
    if (a === "order") openDrawer("order", t.dataset.id);
    if (a === "decision") openDrawer("decision", +t.dataset.id);
    if (a === "yes") { const c = $("#ask"); c.classList.add("fly"); const id = t.dataset.id; setTimeout(() => { const r = accept(id); UI.reasoning = false; if (r) toast(`Done. Chance of being late: ${Math.round(r.before * 100)}% to ${Math.round(r.after * 100)}%.`); render(); }, 360); }
    if (a === "yes-drawer") { const r = accept(t.dataset.id); if (r) toast(`Done. Chance of being late: ${Math.round(r.before * 100)}% to ${Math.round(r.after * 100)}%.`); render(); drawDrawer(); }
    if (a === "no") { UI.reasoning = true; render(); }
    if (a === "cancelreason") { UI.reasoning = false; render(); }
    if (a === "reason") { const c = $("#ask"), id = t.dataset.id, r = t.dataset.r; c.classList.add("flyl"); setTimeout(() => { Object.assign(S.alerts[id], { status: "overridden", at: S.clock, by: "You", reason: r }); log(`Handled ${id} differently`, r); feed("you", "You took this one yourself"); UI.reasoning = false; toast("Noted. VACHAN will learn from that."); render(); }, 360); }
    if (a === "override") openDrawer("override", t.dataset.id);
    if (a === "alloc-reason") { S.allocDecision = { type: "Changed by you", at: S.clock }; log("Changed VACHAN's split of the steel", t.dataset.r); closeDrawer(); render(); toast("Noted, with your reason."); }
    if (a === "confirm") { confirmOrder(t.dataset.id); render(); drawDrawer(); toast("Date given."); }
    if (a === "preset") preset(t.dataset.p);
    if (a === "playrule") { const r = M.solve(S.alloc); playRule($("#splitroot"), S.alloc, r, {}); }
    if (a === "alloc-approve") { const r = M.solve(S.alloc), v = r.options.find(o => o.ours).value; S.allocDecision = { type: "Approved", at: S.clock }; log("Approved the split of the steel", `${r.final.rows.map(x => x.c.name + " " + x.gets.toFixed(1) + " KT").join(", ")}. Worth ${cr(v)}.`); feed("you", `Steel split approved, worth ${cr(v)}`); updateSplit(true); toast("Approved. Customers get their dates today."); }
    if (a === "vcase") { S.value = clone(M[t.dataset.c]); S.valueMode = t.dataset.c; render(); }
    if (a === "graduate") { const d = S.decisions[DR.id]; d.cur = 0; log(`"${d.name}" is now automatic`, "All five tests passed."); render(); drawDrawer(); toast("That decision is now automatic."); }
    if (a === "demote") { const d = S.decisions[DR.id]; d.cur = 1; log(`"${d.name}" moved back to AI suggests`, ""); render(); drawDrawer(); }
    if (a === "csv") { const rows = [["When", "Who", "What", "Why"]].concat(S.audit.map(x => [when(x.t), x.who, x.what, x.why])); const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n"); const u = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); const l = document.createElement("a"); l.href = u; l.download = "vachan-decisions.csv"; l.click(); URL.revokeObjectURL(u); }
    if (a === "mission") { if (Story.open) closeStory(); S.welcomed = true; openStory(t.dataset.m); }
    if (a === "story-close") { S.welcomed = true; closeStory(); render(); }
    if (a === "story-next") { Story.i++; drawStory(); }
    if (a === "try") { Story.tried[t.dataset.k] = true; drawStory(); }
    if (a === "line-approve") { const o = story("line"), al = S.alerts[o.id]; if (al && al.status === "open") accept(o.id); S.allocDecision = { type: "Approved", at: S.clock }; log("Approved the split of the steel", "OEM A 5.0, OEM B 3.0, Retail 2.0, Export 1.5 KT. Worth ₹18.07 Cr."); finishMission("line", "Line saved. Check your promise meter."); }
    if (a === "pool") { const f = $("#fleet"), o = story("pipe"), al = S.alerts[o.id]; t.disabled = true; $$("svg", f).forEach((s, i) => { if (i > 2) { s.style.width = "0"; s.style.opacity = "0"; } }); f.classList.add("full"); if (al && al.status === "open") accept(o.id); later(() => { Story.i++; drawStory(); }, 1100); }
    if (a === "pipe-done") finishMission("pipe", "The pipe maker has a real date now.");
    if (a === "story-match") { const l = S.lots.find(x => x.id === t.dataset.id); doMatch(l); Story.matched++; const from = S.recovered - lotValue(l); drawStory(); const sv = $("#sv"); sv._v = from; countTo(sv, S.recovered, v => cr(v)); }
    if (a === "stock-done") finishMission("stock", "Old steel found a home.");
    save();
  });
  document.addEventListener("input", ev => {
    const t = ev.target, k = t.dataset && t.dataset.input; if (!k) return;
    if (k === "q") { UI.q = t.value; const d = document.createElement("div"); d.innerHTML = MORE.orders[1](); $("#otable").innerHTML = $("#otable", d).innerHTML; }
    if (k === "tq") { UI.tq = t.value; $("#tlist").innerHTML = truckList(); }
    if (k === "customer") { UI.customer = t.value; render(); }
    if (k === "alloc") {
      const v = t.tagName === "SELECT" ? t.value : (t.value === "" ? 0 : +t.value); setPath(S.alloc, t.dataset.path, v); S.allocDecision = null; clearTimers();
      $$(`[data-path="${t.dataset.path}"]`).forEach(x => { if (x !== t) x.value = v; });
      const out = $(`[data-out="${t.dataset.path}"]`); if (out) out.textContent = t.dataset.path.includes("margin") ? frs(v) : fkt(v);
      updateSplit();
    }
    if (k === "value") { S.value[t.dataset.key] = +t.value; S.valueMode = ""; $("#o_" + t.dataset.key).textContent = SF[t.dataset.f](+t.value); $$(".chip[data-act=vcase]").forEach(c => c.classList.remove("on")); updateWorth(); }
    if (k === "pilot") { setPath(S.pilots, t.dataset.path, +t.value); const i = +t.dataset.path.split(".")[0], p = S.pilots[i], r = gateResult(p), pv = $("#pv" + i); pv.className = "verdict " + r.cls; pv.textContent = r.text; p.gates.forEach((g, gi) => { $(`#g${i}_${gi}`).innerHTML = gatePill(g); }); }
    if (k === "sig") { const o = S.orders.find(x => x.id === t.dataset.id); o.sig[t.dataset.sig] = t.checked; const v = view(o); log(`${t.checked ? "Restored" : "Lost"} ${t.dataset.sig} signal on ${o.id}`, `Now using ${v.signal.label}, ${Math.round(v.conf * 100)}% sure.`, "VACHAN"); syncAlerts(); drawDrawer(); }
    if (k === "dec") { const d = S.decisions[+t.dataset.id]; d[t.dataset.k] = +t.value; const dt = $("#dt"); if (dt) dt.innerHTML = testsList(M.graduationTests(d)); const g = $('[data-act="graduate"]'); if (g) g.disabled = !M.graduationTests(d).every(x => x.ok); }
    save();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { if (Story.open) { closeStory(); render(); } else closeDrawer(); } });
  const tip = $("#tip");
  document.addEventListener("mousemove", e => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (!t || !t.getAttribute("data-tip")) { tip.style.display = "none"; return; }
    tip.textContent = t.getAttribute("data-tip"); tip.style.display = "block";
    const w = tip.offsetWidth; tip.style.left = Math.min(e.clientX + 12, innerWidth - w - 8) + "px"; tip.style.top = (e.clientY + 14) + "px";
  });

  const NAV = [["today", "Today"], ["needs", "Needs you"], ["track", "Where's my steel"], ["split", "Split the steel"], ["worth", "Is it worth it?"], ["more", "Behind the scenes"]];
  function route() { const r = location.hash.slice(1).split("/"); return [VIEWS[r[0]] ? r[0] : "today", r[1]]; }
  function render() {
    clearTimers(); syncAlerts();
    const r = route()[0];
    $("#main").innerHTML = VIEWS[r]();
    $("#nav").innerHTML = NAV.map(([k, l]) => `<a href="#${k}" class="${k === r ? "on" : ""}" ${k === r ? 'aria-current="page"' : ""}>${l}${k === "needs" ? `<span class="n" id="nb"></span>` : ""}</a>`).join("");
    mountMap();
    if (r === "split") updateSplit();
    if (r === "worth") updateWorth();
    const fd = $("#feed"); if (fd) fd.innerHTML = S.feed.slice(0, 12).map(feedItem).join("");
    refreshLive();
    save();
  }
  function seedFeed() { feed("truck", "Trucks are rolling out of Jamshedpur and Kalinganagar"); feed("auto", `VACHAN handled ${S.autoCount} small problems overnight`); feed("alert", "A carmaker is running very low on steel"); }
  window.addEventListener("hashchange", () => { closeDrawer(); if (Story.open) closeStory(); UI.reasoning = false; render(); window.scrollTo(0, 0); });
  if (firstRun) { markTold(); syncAlerts(true); seedFeed(); }
  render();
  requestAnimationFrame(frame);
  if (!S.welcomed) { S.welcomed = true; openStory("welcome"); save(); }
  // hooks for the automated browser test
  window.__vachan = { state: () => S, kpis, pause: () => { S.running = false; }, advance };
})();
