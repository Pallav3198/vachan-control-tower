/* VACHAN control tower UI: state, screens and actions. */
(function () {
  "use strict";
  const M = window.VachanModel, D = window.VachanData;
  const KEY = "vachan-demo-v1";
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const num = (n, d) => Number(n).toLocaleString("en-IN", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const cr = (n, d) => (n < 0 ? "-" : "") + "₹" + num(Math.abs(n), d == null ? 2 : d) + " Cr";
  const TIERS = { P: "Protected", S: "Strategic", C: "Committed", F: "Flow" };
  const CLASSES = ["Automated", "AI-assisted", "Human-led", "Leadership"];
  const CAT = ["#1D4E9E", "#00917F", "#C77700", "#7A3E9D"];
  const REASONS = ["Data was wrong", "Customer information the system lacks", "Commercial judgement", "Other"];

  function fresh() {
    return { clock: 0, orders: D.orders(), lots: clone(D.LOTS), nodes: clone(D.NODES), decisions: clone(D.DECISIONS), pilots: clone(D.PILOTS), alerts: {}, audit: [], alloc: clone(M.EXHIBIT8), allocDecision: null, value: clone(M.BASE), recovered: 0, role: "All" };
  }
  function load() { try { const v = JSON.parse(localStorage.getItem(KEY)); return v && v.orders ? v : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* the demo still works without storage */ } }
  let S = load() || fresh();
  let DR = null;
  const UI = { q: "", tier: "", stage: "", onlyRisk: false, customer: null };

  // ---------------------------------------------------------------- time
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  function when(h) {
    if (h == null) return "-";
    const t = h + 9, day = Math.floor(t / 24), hr = Math.floor(t - day * 24), mn = Math.round((t - Math.floor(t)) * 60);
    const name = DAYS[((day % 7) + 7) % 7], pre = day >= 7 ? "next " : day < 0 ? "last " : "";
    return pre + name + " " + String(hr).padStart(2, "0") + ":" + String(mn === 60 ? 59 : mn).padStart(2, "0");
  }
  function hoursMins(h) { const a = Math.abs(h), H = Math.floor(a), m = Math.round((a - H) * 60); return H + " h " + String(m).padStart(2, "0") + " m"; }

  // ---------------------------------------------------------------- derived order state
  function view(o) {
    const c = S.clock;
    let stage;
    if (o.confirm == null) stage = "Awaiting date";
    else if (c >= o.eta) stage = "Delivered";
    else if (c >= o.dispatch) stage = "In transit";
    else if (c >= o.produced) stage = "Produced";
    else stage = "Committed";
    const signal = M.bestSignal(o.sig);
    const conf = stage === "In transit" ? (o.mode === "Rail" ? 0.9 : signal.confidence) : 0.85;
    const slack = o.confirm == null ? null : o.promise - o.eta;
    const done = stage === "Delivered";
    const p = o.confirm == null || done ? 0 : M.lateProbability(slack, conf);
    const var_ = p * ((o.t * o.margin) / 1e7 + (o.penaltyCr || 0));
    return { o, stage, signal, conf, slack, done, p, var: var_, onTime: done && o.eta <= o.promise };
  }
  const inRole = o => S.role === "All" || D.SEGMENTS[o.seg] === S.role;
  const scoped = () => S.orders.filter(inRole).map(view);
  const riskTag = p => p >= 0.75 ? `<span class="tag bad">High ${Math.round(p * 100)}%</span>` : p >= 0.5 ? `<span class="tag warn">Watch ${Math.round(p * 100)}%</span>` : `<span class="tag good">OK ${Math.round(p * 100)}%</span>`;
  const tierTag = t => `<span class="tag ${t === "P" ? "bad" : t === "S" ? "info" : "plain"}" title="${TIERS[t]}">${t} ${TIERS[t]}</span>`;

  function playbook(o) {
    if (o.tier === "P" && o.cover < 5) return { key: "Protect", text: "Dispatch first and bridge by road from in-transit stock", hours: 30, lakh: (o.t * 400) / 1e5 };
    if (o.spc) { const n = S.nodes.find(x => x.id === o.spc); return { key: "Re-source", text: `Serve from matching stock already at ${n ? n.label : "the nearest SPC"}`, hours: 40, lakh: (o.t * 1200) / 1e5, lot: true }; }
    if (o.lots >= 3) return { key: "Pool loads", text: `Merge ${o.lots} part-loads into full trucks`, hours: 12 + o.lots * 7, lakh: -(o.t * 500) / 1e5 };
    return { key: "Expedite", text: "Move to a faster lane and alert the customer", hours: 20, lakh: (o.t * 450) / 1e5 };
  }
  function issue(v) {
    const o = v.o, late = Math.max(0, Math.round(-v.slack));
    if (o.tier === "P" && o.cover < 5) return `Cover ${o.cover.toFixed(1)} days against 3-day lead time`;
    if (o.spc) return `${(o.t / 1000).toFixed(1)} KT of matching stock sits at an SPC`;
    if (o.lots >= 3) return `${late ? "ETA slip " + late + " h, " : "Tight date, "}${o.lots} part-loads`;
    return late ? `ETA slip ${late} h` : `Only ${Math.round(v.slack)} h of slack`;
  }
  const approverFor = pb => pb.key === "Expedite" && pb.lakh > 2 ? "Weekly Commit Room" : null;

  function syncAlerts() {
    S.orders.map(view).forEach(v => {
      if (!v.done && v.p >= 0.5 && !S.alerts[v.o.id]) S.alerts[v.o.id] = { status: "open", raised: S.clock, level: 1 };
    });
  }
  function exceptions() {
    return S.orders.filter(o => S.alerts[o.id] && inRole(o)).map(o => ({ v: view(o), a: S.alerts[o.id], pb: playbook(o) }))
      .sort((x, y) => (x.a.status === "open" ? 0 : 1) - (y.a.status === "open" ? 0 : 1) || y.v.var - x.v.var);
  }
  const openEx = () => exceptions().filter(e => e.a.status === "open" && !e.v.done);
  function levelOf(a) { const age = S.clock - a.raised; return age < 2 ? 1 : age < 4 ? 2 : 3; }
  const LEVELS = { 1: "L1 Planner + AI", 2: "L2 Promise Owner", 3: "L3 Commit Room" };
  function slaLeft(a) { const age = S.clock - a.raised, l = levelOf(a), lim = l === 1 ? 2 : l === 2 ? 4 : 24; return lim - age; }

  function kpis() {
    const list = scoped(), H = D.HISTORY;
    const confirmed = list.filter(v => v.o.confirm != null);
    const good = confirmed.filter(v => (v.done ? v.onTime : v.p < 0.5)).length;
    const scale = S.role === "All" ? 1 : 0.25;
    const otif = ((H.onTime * scale + good) / (H.lines * scale + confirmed.length)) * 100;
    const avg = confirmed.reduce((a, v) => a + (v.o.confirm - v.o.created), 0) / (confirmed.length || 1);
    const risk = list.filter(v => !v.done && v.p >= 0.5);
    const stock = S.nodes.reduce((a, n) => a + n.stock, 0) / D.DAILY_KT;
    const varCr = risk.reduce((a, v) => a + v.var, 0);
    return { otif, avg, risk: risk.length, protectedRisk: risk.filter(v => v.o.tier === "P").length, pending: list.filter(v => v.o.confirm == null).length, stock, varCr };
  }

  function log(what, why, who) { S.audit.unshift({ t: S.clock, who: who || roleName(), what, why: why || "" }); }
  function roleName() { return S.role === "All" ? "Control tower lead" : D.OWNER[S.role]; }
  function toast(m) { const t = $("#toast"); t.textContent = m; t.style.display = "block"; clearTimeout(toast.t); toast.t = setTimeout(() => { t.style.display = "none"; }, 3400); }

  // ---------------------------------------------------------------- charts
  const tipAttr = t => `data-tip="${esc(t)}"`;
  function otifChart(cur) {
    const pts = D.OTIF_HISTORY.concat([cur]), W = 460, H = 170, L = 34, B = 22, T = 10, R = 14;
    const x = i => L + ((W - L - R) * i) / (pts.length - 1), y = v => T + ((H - T - B) * (98 - v)) / (98 - 82);
    const line = pts.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="OTIF by week, latest ${cur.toFixed(1)} percent">
      ${[85, 90, 95].map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#E6EAF0"/><text x="${L - 6}" y="${y(v) + 4}" font-size="11" text-anchor="end" fill="#6B7686">${v}</text>`).join("")}
      <line x1="${L}" x2="${W - R}" y1="${y(96)}" y2="${y(96)}" stroke="#1D7A4F" stroke-dasharray="5 4"/><text x="${L + 4}" y="${y(96) - 4}" font-size="11.5" fill="#1D7A4F">FY29 target 96%</text>
      <path d="${line}" fill="none" stroke="#1D4E9E" stroke-width="2" stroke-linejoin="round"/>
      ${pts.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="${i === pts.length - 1 ? 5 : 3}" fill="#1D4E9E" stroke="#fff" stroke-width="1.5"/><rect x="${x(i) - 18}" y="${T}" width="36" height="${H - T - B}" fill="transparent" ${tipAttr((i === pts.length - 1 ? "Now, projected: " : "Week " + (i - pts.length + 1) + ": ") + v.toFixed(1) + "%")}/>`).join("")}
      <text x="${x(pts.length - 1)}" y="${y(cur) - 10}" font-size="12.5" font-weight="650" text-anchor="end" fill="#0F2D5C">${cur.toFixed(1)}%</text>
      <text x="${L}" y="${H - 6}" font-size="11" fill="#6B7686">11 weeks ago</text><text x="${W - R}" y="${H - 6}" font-size="11" text-anchor="end" fill="#6B7686">now</text>
    </svg></div>`;
  }
  function hbars(items, opt) {
    const o = Object.assign({ w: 520, lw: 170, rh: 26, unit: "", d: 1 }, opt), max = Math.max.apply(null, items.map(i => Math.abs(i.v))) || 1, bw = o.w - o.lw - 62;
    return `<div class="chart"><svg viewBox="0 0 ${o.w} ${items.length * o.rh + 2}" role="img" aria-label="${esc(o.aria || "Bar chart")}">${items.map((it, i) => { const w = Math.max(2, (Math.abs(it.v) / max) * bw), y = i * o.rh + 4; return `<text x="${o.lw - 8}" y="${y + 13}" font-size="12.5" text-anchor="end" fill="#141A24" font-weight="${it.bold ? 650 : 400}">${esc(it.l)}</text><rect x="${o.lw}" y="${y + 2}" width="${w}" height="14" rx="2" fill="${it.c || "#1D4E9E"}"/><text x="${o.lw + w + 6}" y="${y + 13}" font-size="12.5" font-weight="650" fill="#141A24">${esc(it.t || num(it.v, o.d) + o.unit)}</text><rect x="0" y="${y - 3}" width="${o.w}" height="${o.rh}" fill="transparent" ${tipAttr(it.l + ": " + (it.t || num(it.v, o.d) + o.unit) + (it.tip ? ". " + it.tip : ""))}/>`; }).join("")}</svg></div>`;
  }
  function gantt(res, s) {
    const rows = res.final.rows.filter(r => r.mill > 0), horizon = Math.max(s.days, ...rows.map(r => r.end || 0)), W = 700, H = 104, L = 8, R = 8, x = d => L + ((W - L - R) * d) / horizon;
    const names = s.customers.map(c => c.name);
    const marks = s.customers.filter(c => (c.tier === "P" || c.tier === "S") && c.cover <= horizon);
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Campaign sequence by day">
      ${marks.map(c => `<line x1="${x(c.cover)}" x2="${x(c.cover)}" y1="18" y2="74" stroke="#B3261E" stroke-dasharray="4 3"/><text x="${x(c.cover) + 4}" y="14" font-size="11.5" font-weight="650" fill="#B3261E" ${x(c.cover) > W * 0.7 ? `text-anchor="end" dx="-8"` : ""}>${esc(c.name)} cover ends</text>`).join("")}
      ${rows.map(r => { const c = CAT[names.indexOf(r.c.name) % 4], w = x(r.end) - x(r.start); return `<rect x="${x(r.start) + 1}" y="26" width="${Math.max(1, w - 2)}" height="40" rx="2" fill="${c}" ${tipAttr(`${r.c.name}: ${r.mill.toFixed(2)} KT from the mill, day ${r.start.toFixed(1)} to ${r.end.toFixed(1)}`)}/>${w > 62 ? `<text x="${x(r.start) + w / 2}" y="50" font-size="12.5" font-weight="650" fill="#fff" text-anchor="middle" pointer-events="none">${esc(r.c.name)} ${r.mill.toFixed(1)}</text>` : ""}`; }).join("")}
      <line x1="${L}" x2="${W - R}" y1="74" y2="74" stroke="#141A24"/>
      ${Array.from({ length: Math.floor(horizon / 2) + 1 }, (_, i) => i * 2).map(d => `<text x="${x(d)}" y="92" font-size="11" text-anchor="middle" fill="#6B7686">D${d}</text>`).join("")}
    </svg></div><div class="legend">${s.customers.map((c, i) => `<span><i style="background:${CAT[i % 4]}"></i>${esc(c.name)}</span>`).join("")}</div>`;
  }
  function waterfall(L) {
    const items = [["Logistics", L.logistics], ["Allocation", L.allocation], ["Mix + penalties", L.mix], ["High-age", L.highAge], ["Productivity", L.productivity]];
    let cum = 0; const bars = items.map(([n, v]) => { const b = { n, a: cum, z: cum + v, c: "#4F78B8" }; cum += v; return b; });
    bars.push({ n: "EBITDA", a: 0, z: cum, c: "#0F2D5C" }, { n: "Carrying (P&L)", a: cum, z: cum + L.carrying, c: "#9DB7E0" }, { n: "Total P&L", a: 0, z: cum + L.carrying, c: "#0F2D5C" });
    const W = 560, H = 210, B = 40, T = 18, max = Math.max(bars[7].z, 1) * 1.05, bw = (W - 16) / bars.length, y = v => T + (H - T - B) * (1 - v / max);
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="FY29 benefit by lever">${bars.map((b, i) => { const x = 8 + i * bw + 8, w = bw - 16; return `<rect x="${x}" y="${y(b.z)}" width="${w}" height="${Math.max(1, y(b.a) - y(b.z))}" rx="2" fill="${b.c}" ${tipAttr(b.n + ": ₹" + num(b.z - b.a) + " Cr a year")}/><text x="${x + w / 2}" y="${y(b.z) - 5}" font-size="12.5" font-weight="650" text-anchor="middle" fill="#141A24">${num(b.z - b.a)}</text><text x="${x + w / 2}" y="${H - 22}" font-size="11" text-anchor="middle" fill="#4B5666">${esc(b.n.split(" ")[0])}</text><text x="${x + w / 2}" y="${H - 9}" font-size="11" text-anchor="middle" fill="#4B5666">${esc(b.n.split(" ").slice(1).join(" "))}</text>`; }).join("")}<line x1="8" x2="${W - 8}" y1="${y(0)}" y2="${y(0)}" stroke="#141A24"/></svg></div>`;
  }
  function flowsChart(flows) {
    const W = 460, H = 170, B = 22, T = 20, max = Math.max(...flows, 1), min = Math.min(...flows, 0), bw = (W - 20) / flows.length, y = v => T + ((H - T - B) * (max - v)) / (max - min);
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Net cash flow by year">${flows.map((f, i) => { const x = 10 + i * bw + 16, w = bw - 32; return `<rect x="${x}" y="${Math.min(y(f), y(0))}" width="${w}" height="${Math.max(1, Math.abs(y(f) - y(0)))}" rx="2" fill="${f < 0 ? "#B3261E" : "#1D4E9E"}" ${tipAttr(M.YEARS[i] + ": ₹" + num(f) + " Cr")}/><text x="${x + w / 2}" y="${Math.min(y(f), y(0)) - 5}" font-size="12.5" font-weight="650" text-anchor="middle" fill="#141A24">${num(f)}</text><text x="${x + w / 2}" y="${H - 6}" font-size="11.5" text-anchor="middle" fill="#4B5666">${M.YEARS[i]}</text>`; }).join("")}<line x1="10" x2="${W - 10}" y1="${y(0)}" y2="${y(0)}" stroke="#141A24"/></svg></div>`;
  }
  function tornadoChart(rows) {
    const sorted = rows.slice().sort((a, b) => (Math.abs(b[1]) + Math.abs(b[2])) - (Math.abs(a[1]) + Math.abs(a[2])));
    const W = 1040, rh = 25, lw = 190, H = sorted.length * rh + 6, max = Math.max(1, ...sorted.map(r => Math.max(Math.abs(r[1]), Math.abs(r[2])))), mid = lw + (W - lw - 56) / 2 + 28, half = (W - lw - 56) / 2 - 8;
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="NPV sensitivity by driver">${sorted.map((r, i) => { const y = i * rh + 4, a = (Math.abs(r[1]) / max) * half, b = (Math.abs(r[2]) / max) * half; return `<text x="${lw - 8}" y="${y + 13}" font-size="12.5" text-anchor="end" fill="#141A24">${esc(r[0])}</text><rect x="${mid - a}" y="${y + 2}" width="${a}" height="14" rx="2" fill="#9DB7E0"/><rect x="${mid}" y="${y + 2}" width="${b}" height="14" rx="2" fill="#0F2D5C"/><text x="${mid - a - 5}" y="${y + 13}" font-size="12" text-anchor="end" fill="#4B5666">${num(r[1])}</text><text x="${mid + b + 5}" y="${y + 13}" font-size="12" fill="#4B5666">${r[2] ? "+" + num(r[2]) : "0"}</text><rect x="0" y="${y - 2}" width="${W}" height="${rh}" fill="transparent" ${tipAttr(`${r[0]}: ${num(r[1])} / +${num(r[2])} Cr of NPV`)}/>`; }).join("")}<line x1="${mid}" x2="${mid}" y1="0" y2="${H}" stroke="#141A24"/></svg></div><div class="legend"><span><i style="background:#9DB7E0"></i>Low case</span><span><i style="background:#0F2D5C"></i>High case</span></div>`;
  }

  // ---------------------------------------------------------------- map
  function mapHTML(h) { return `<div id="map" data-h="${h || 360}"></div>`; }
  function mountMap() {
    const el = $("#map"); if (!el) return;
    const ns = "http://www.w3.org/2000/svg", I = window.INDIA_MAP;
    const lanes = {};
    S.orders.filter(inRole).map(view).filter(v => v.stage === "In transit").forEach(v => { const k = v.o.origin + "-" + v.o.dest; const l = lanes[k] = lanes[k] || { a: v.o.origin, b: v.o.dest, p: 0, n: 0, t: 0 }; l.p = Math.max(l.p, v.p); l.n++; l.t += v.o.t; });
    el.innerHTML = `<svg viewBox="${I.viewBox}" style="width:100%;height:auto;display:block" role="img" aria-label="Network map of plants, service centres and lanes"><g fill="#DCE7F6" stroke="#fff" stroke-width="1.2">${I.paths.map(p => `<path id="st-${p[0]}" d="${p[1]}"/>`).join("")}</g><g id="rt"></g><g id="pn"></g></svg>
      <div class="legend"><span><i style="background:#1D4E9E"></i>Lane on track</span><span><i style="background:#C77700"></i>Lane on watch</span><span><i style="background:#B3261E"></i>Lane at high risk</span></div>`;
    const svg = el.querySelector("svg"), pos = {};
    S.nodes.forEach(n => { const b = svg.querySelector("#st-" + n.st).getBBox(); pos[n.id] = [b.x + b.width * n.fx, b.y + b.height * n.fy]; });
    const rt = svg.querySelector("#rt"), pn = svg.querySelector("#pn");
    Object.values(lanes).forEach(l => {
      const a = pos[l.a], c = pos[l.b], d = Math.hypot(c[0] - a[0], c[1] - a[1]) * 0.18;
      const e = document.createElementNS(ns, "path"), col = l.p >= 0.75 ? "#B3261E" : l.p >= 0.5 ? "#C77700" : "#1D4E9E";
      e.setAttribute("d", `M${a[0]} ${a[1]} Q${(a[0] + c[0]) / 2} ${(a[1] + c[1]) / 2 - d} ${c[0]} ${c[1]}`); e.setAttribute("fill", "none"); e.setAttribute("stroke", col); e.setAttribute("stroke-width", l.p >= 0.5 ? 3.2 : 2); if (l.p >= 0.5) e.setAttribute("stroke-dasharray", "7 6"); e.setAttribute("stroke-linecap", "round");
      e.setAttribute("data-tip", `${S.nodes.find(n => n.id === l.a).label} to ${S.nodes.find(n => n.id === l.b).label}: ${l.n} shipment${l.n > 1 ? "s" : ""}, ${num(l.t)} t, worst late risk ${Math.round(l.p * 100)}%`);
      rt.appendChild(e);
    });
    S.nodes.forEach(n => {
      const [x, y] = pos[n.id], c = document.createElementNS(ns, "circle");
      c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", n.kind === "Plant" ? 9 : 7); c.setAttribute("fill", n.kind === "Plant" ? "#0F2D5C" : "#4F78B8"); c.setAttribute("stroke", "#fff"); c.setAttribute("stroke-width", 2.2);
      c.setAttribute("data-tip", `${n.label} (${n.kind}): ${num(n.stock)} KT stock`); pn.appendChild(c);
      const t = document.createElementNS(ns, "text"); t.setAttribute("x", x + n.dx); t.setAttribute("y", y + n.dy); t.setAttribute("font-size", 18); t.setAttribute("font-weight", 650); t.setAttribute("fill", "#0F2D5C"); if (n.anchor) t.setAttribute("text-anchor", n.anchor); t.textContent = n.label; pn.appendChild(t);
    });
  }

  // ---------------------------------------------------------------- screens
  const kpiCards = k => `<div class="kpis">
    <div class="kpi ${k.otif >= 90 ? "good" : "warn"}"><div class="l">OTIF, last 4 weeks, projected</div><div class="v">${k.otif.toFixed(1)}%</div><div class="d">FY29 target ≥96%</div></div>
    <div class="kpi good"><div class="l">Average time to confirm</div><div class="v">${hoursMins(k.avg)}</div><div class="d">${k.pending} waiting; target under 6 h</div></div>
    <div class="kpi ${k.risk ? "bad" : "good"}"><div class="l">Orders at risk</div><div class="v">${k.risk}</div><div class="d">${k.protectedRisk} Protected</div></div>
    <div class="kpi ${k.stock <= 23 ? "good" : "warn"}"><div class="l">Network stock</div><div class="v">${k.stock.toFixed(1)} d</div><div class="d">target 23 days</div></div>
    <div class="kpi ${k.varCr > 2 ? "bad" : "good"}"><div class="l">Value at risk</div><div class="v">${cr(k.varCr, 1)}</div><div class="d">open at-risk orders</div></div>
  </div>`;
  const exRow = e => { const c = e.v.p >= 0.75 ? "var(--bad)" : e.v.p >= 0.5 ? "#C77700" : "var(--good)"; return `<div class="ex" data-act="order" data-id="${e.v.o.id}"><span class="bar" style="background:${c}"></span><div><b>${esc(e.v.o.customer)}</b>, ${esc(e.v.o.grade)}, ${num(e.v.o.t)} t<small>${esc(issue(e.v))}</small></div><div class="row"><span class="tag info">${esc(e.pb.key)}</span>${riskTag(e.v.p)}</div></div>`; };

  const VIEWS = {
    overview() {
      const k = kpis(), ex = openEx(), res = M.solve(S.alloc);
      return `<div class="ph"><div><h1>Good morning, ${esc(roleName())}</h1><p>${ex.length ? `${ex.length} predicted exception${ex.length > 1 ? "s" : ""} need a decision.` : "No open exceptions."} Every number on this screen responds to the actions you take.</p></div></div>
      ${kpiCards(k)}
      <div class="grid g-map"><section class="panel"><h2>Network risk map</h2><div class="pb">${mapHTML()}</div></section>
      <div class="grid g2" style="align-content:start">
        <section class="panel"><h2>Predicted exceptions <small>highest value at risk first</small></h2><div class="pb flush scroll" style="max-height:430px">${ex.slice(0, 9).map(exRow).join("") || `<div class="pb">Nothing open. Press +6 hours to move time forward.</div>`}</div></section>
        <div class="grid" style="align-content:start">
          <section class="panel"><h2>OTIF by week</h2><div class="pb">${otifChart(k.otif)}</div></section>
          <section class="panel"><h2>Suggested split of the 10 KT campaign</h2><div class="pb">${res.final.rows.map(r => `<div class="row spread" style="padding:2px 0"><span><b>${esc(r.c.name)}</b> ${r.gets.toFixed(1)} KT</span><span class="tag info">${esc(r.rule)}</span></div>`).join("")}<div class="row spread" style="margin-top:8px"><span>Net value <b>${cr(res.options.find(o => o.ours).value)}</b></span><a class="btn sm" href="#allocation">Open 4R card</a></div></div></section>
        </div></div></div>`;
    },
    orders() {
      let list = scoped();
      const q = UI.q.toLowerCase();
      if (q) list = list.filter(v => (v.o.id + " " + v.o.customer + " " + v.o.grade).toLowerCase().includes(q));
      if (UI.tier) list = list.filter(v => v.o.tier === UI.tier);
      if (UI.stage) list = list.filter(v => v.stage === UI.stage);
      if (UI.onlyRisk) list = list.filter(v => v.p >= 0.5);
      list.sort((a, b) => b.p - a.p || (a.o.promise - b.o.promise));
      const stages = ["Awaiting date", "Committed", "Produced", "In transit", "Delivered"];
      return `<div class="ph"><div><h1>Orders</h1><p>Every order line from capture to delivery, with its live late-delivery risk. Click a row to see why.</p></div></div>
      <div class="filters"><input id="q" placeholder="Search order, customer or grade" value="${esc(UI.q)}" data-input="q" aria-label="Search">
        <select data-input="tier" aria-label="Tier"><option value="">All tiers</option>${Object.keys(TIERS).map(t => `<option value="${t}" ${UI.tier === t ? "selected" : ""}>${TIERS[t]}</option>`).join("")}</select>
        <select data-input="stage" aria-label="Stage"><option value="">All stages</option>${stages.map(s => `<option ${UI.stage === s ? "selected" : ""}>${s}</option>`).join("")}</select>
        <label class="row"><input type="checkbox" data-input="onlyRisk" ${UI.onlyRisk ? "checked" : ""}> At risk only</label><span id="count" style="color:var(--sub)">${list.length} orders</span></div>
      <section class="panel"><div class="pb flush scroll" id="ordersTable">${ordersTable(list)}</div></section>`;
    },
    exceptions() {
      const all = exceptions(), open = all.filter(e => e.a.status === "open" && !e.v.done), done = all.filter(e => !(e.a.status === "open" && !e.v.done));
      return `<div class="ph"><div><h1>Exceptions</h1><p>Each predicted miss gets one owner, one recommended playbook and a clock. If the clock runs out, it moves up a level automatically.</p></div></div>
      <section class="panel"><h2>Open <small>${open.length}</small></h2><div class="pb flush wide"><table class="t"><tr><th>Risk</th><th>Order</th><th>Customer</th><th>Issue</th><th>Recommended</th><th class="r">At risk</th><th>Owner</th><th>Level</th><th class="r">Clock</th><th>Decide</th></tr>
      ${open.map(e => `<tr class="click" data-act="order" data-id="${e.v.o.id}"><td>${riskTag(e.v.p)}</td><td>${e.v.o.id}</td><td>${esc(e.v.o.customer)}</td><td>${esc(issue(e.v))}</td><td>${esc(e.pb.text)}</td><td class="r">${cr(e.v.var)}</td><td>${esc(D.OWNER[D.SEGMENTS[e.v.o.seg]])}</td><td>${LEVELS[levelOf(e.a)]}</td><td class="r">${slaLeft(e.a).toFixed(0)} h</td><td class="row" style="flex-wrap:nowrap"><button class="btn sm" data-act="accept" data-id="${e.v.o.id}">Accept</button><button class="btn sm alt" data-act="override" data-id="${e.v.o.id}">Override</button></td></tr>`).join("") || `<tr><td colspan="10">Nothing open.</td></tr>`}</table></div></section>
      <section class="panel mt"><h2>Handled <small>${done.length}</small></h2><div class="pb flush wide"><table class="t"><tr><th>Order</th><th>Customer</th><th>Outcome</th><th>By</th><th>When</th><th>Reason</th><th>Risk now</th></tr>
      ${done.map(e => `<tr class="click" data-act="order" data-id="${e.v.o.id}"><td>${e.v.o.id}</td><td>${esc(e.v.o.customer)}</td><td><span class="tag ${e.a.status === "accepted" ? "good" : e.a.status === "overridden" ? "warn" : "plain"}">${e.a.status === "accepted" ? "Playbook accepted" : e.a.status === "overridden" ? "Overridden" : "Delivered"}</span></td><td>${esc(e.a.by || "-")}</td><td>${e.a.at != null ? when(e.a.at) : "-"}</td><td>${esc(e.a.reason || "-")}</td><td>${e.v.done ? "-" : riskTag(e.v.p)}</td></tr>`).join("") || `<tr><td colspan="7">Nothing yet. Accept or override an open exception.</td></tr>`}</table></div></section>`;
    },
    allocation() {
      const s = S.alloc, P = [["Exhibit 8", "base"], ["Displaced grade earns ₹0", "disp"], ["SPC stock unusable", "spc"], ["OEM A needs 6.5 KT", "a65"], ["OEM A needs 10.5 KT", "a105"], ["Export margin ₹40,000", "exp"]];
      const inp = (path, val, step) => `<input class="cell" type="number" step="${step || 0.5}" min="0" value="${val}" data-input="alloc" data-path="${path}" aria-label="${path}">`;
      return `<div class="ph"><div><h1>Allocation: the 4R card</h1><p>Protect, Re-source, Re-time, Rank, then a ₹ stretch test. Change any blue number and the decision recalculates.</p></div><div class="row">${P.map(p => `<button class="btn sm alt" data-act="preset" data-p="${p[1]}">${esc(p[0])}</button>`).join("")}</div></div>
      <div class="grid g-side"><div class="grid" style="align-content:start">
        <section class="panel"><h2>Demand</h2><div class="pb flush wide"><table class="t"><tr><th>Customer</th><th class="r">Need KT</th><th class="r">₹/t</th><th class="r">Cover d</th><th>Tier</th><th class="r" title="Rupees at risk if missed">Risk ₹ Cr</th><th class="r" title="Probability of a miss">P(miss)</th></tr>
        ${s.customers.map((c, i) => `<tr><td><b>${esc(c.name)}</b></td><td class="r">${inp(`customers.${i}.need`, c.need)}</td><td class="r">${inp(`customers.${i}.margin`, c.margin, 500)}</td><td class="r">${inp(`customers.${i}.cover`, c.cover, 1)}</td><td><select class="cell" data-input="alloc" data-path="customers.${i}.tier" aria-label="Tier">${Object.keys(TIERS).map(t => `<option value="${t}" ${c.tier === t ? "selected" : ""}>${t}</option>`).join("")}</select></td><td class="r">${inp(`customers.${i}.penaltyCr`, c.penaltyCr)}</td><td class="r">${inp(`customers.${i}.pMiss`, c.pMiss, 0.1)}</td></tr>`).join("")}</table></div></section>
        <section class="panel"><h2>Supply and costs</h2><div class="pb"><div class="fields">
          <label>Campaign KT ${inp("campaign", s.campaign)}</label><label>Campaign days ${inp("days", s.days, 1)}</label>
          <label>Extension KT ${inp("extension", s.extension)}</label><label>Displaced ₹/t ${inp("displaced", s.displaced, 500)}</label>
          <label>Changeover ₹ Cr ${inp("changeover", s.changeover)}</label><label>Line stop ₹ Cr ${inp("stopCr", s.stopCr)}</label>
          <label>SPC stock KT ${inp("network.kt", s.network.kt)}</label><label>SPC freight ₹/t ${inp("network.freight", s.network.freight, 100)}</label>
        </div><p class="note">The SPC stock matches ${esc(s.network.customer)} orders. Protect applies to tier P customers with cover below lead time + 2 days.</p></div></section>
      </div><div id="allocResults">${allocResults()}</div></div>`;
    },
    network() {
      const ship = scoped().filter(v => v.stage === "In transit").sort((a, b) => b.p - a.p), maxS = Math.max(...S.nodes.map(n => n.stock));
      return `<div class="ph"><div><h1>Network</h1><p>Where stock sits, what is moving, and what is ageing. Click a shipment, then switch off GPS to see the fallback ladder at work.</p></div></div>
      <div class="grid g-map"><div class="grid" style="align-content:start"><section class="panel"><h2>Lanes</h2><div class="pb">${mapHTML()}</div></section>
      <section class="panel"><h2>Stock by location, KT</h2><div class="pb">${hbars(S.nodes.slice().sort((a, b) => b.stock - a.stock).map(n => ({ l: n.label, v: n.stock, t: num(n.stock, n.stock % 1 ? 1 : 0), c: n.kind === "Plant" ? "#0F2D5C" : "#4F78B8" })), { w: 320, lw: 96, rh: 22, aria: "Stock by location" })}<div class="legend"><span><i style="background:#0F2D5C"></i>Plant</span><span><i style="background:#4F78B8"></i>SPC or yard</span></div></div></section></div>
      <div class="grid" style="align-content:start"><section class="panel"><h2>Shipments in transit <small>${ship.length}</small></h2><div class="pb flush scroll" style="max-height:370px"><table class="t"><tr><th>Order</th><th>Customer</th><th>Lane</th><th>Mode</th><th>Located by</th><th class="r">Confidence</th><th>ETA</th><th>Promise</th><th>Risk</th></tr>
      ${ship.map(v => `<tr class="click" data-act="order" data-id="${v.o.id}"><td>${v.o.id}</td><td>${esc(v.o.customer)}</td><td>${nodeName(v.o.origin)} to ${nodeName(v.o.dest)}</td><td>${v.o.mode}</td><td>${v.o.mode === "Rail" ? "FOIS rake status" : esc(v.signal.label)}</td><td class="r">${Math.round(v.conf * 100)}%</td><td>${when(v.o.eta)}</td><td>${when(v.o.promise)}</td><td>${riskTag(v.p)}</td></tr>`).join("")}</table></div></section>
      <section class="panel"><h2>High-age stock <small>matched before it is sold at a discount</small></h2><div class="pb flush wide"><table class="t"><tr><th>Lot</th><th>Location</th><th>Grade</th><th class="r">KT</th><th class="r">Age, days</th><th>Open demand</th><th class="r">Loss avoided</th><th></th></tr>
      ${S.lots.map(l => `<tr><td>${l.id}</td><td>${nodeName(l.node)}</td><td>${esc(l.grade)}</td><td class="r">${l.kt.toFixed(1)}</td><td class="r">${l.age}</td><td>${esc(l.match)}</td><td class="r">${cr(lotValue(l))}</td><td>${l.done ? `<span class="tag good">Matched</span>` : `<button class="btn sm" data-act="match" data-id="${l.id}">Match</button>`}</td></tr>`).join("")}</table></div><div class="pb" style="padding-top:6px"><b>${cr(S.recovered)}</b> recovered so far, at 10% of realisation on ₹65,000 per tonne.</div></section></div></div>`;
    },
    decisions() {
      const counts = [0, 1, 2, 3].map(c => S.decisions.filter(d => d.cur === c).length), tot = S.decisions.length;
      const dot = (d, c) => { const f27 = d.fy27 === c, cur = d.cur === c; if (cur) return `<span title="Now" style="display:inline-block;width:15px;height:15px;border-radius:50%;background:#0F2D5C"></span>`; if (f27) return `<span title="FY27" style="display:inline-block;width:15px;height:15px;border-radius:50%;border:2px solid #9DB7E0"></span>`; return d.fy29 === c ? `<span title="FY29 target" style="color:#6B7686">target</span>` : ""; };
      return `<div class="ph"><div><h1>Decision rights</h1><p>AI recommends and a named human commits. An assisted decision moves to automatic only when all five tests hold, and drops back if overrides spike.</p></div></div>
      <div class="grid g-side" style="align-items:start"><section class="panel"><h2>Where decisions sit now</h2><div class="pb">${hbars(CLASSES.map((c, i) => ({ l: c, v: counts[i], t: counts[i] + " of " + tot, c: ["#0F2D5C", "#4F78B8", "#C77700", "#7A3E9D"][i] })), { w: 460, lw: 100, rh: 28, aria: "Decisions by class" })}<p class="note">Solid circle is where a decision sits now; hollow is its FY27 starting point.</p></div></section>
      <section class="panel"><h2>Decision inventory <small>click a row to test it</small></h2><div class="pb flush wide"><table class="t"><tr><th>Decision</th>${CLASSES.map(c => `<th class="c">${c}</th>`).join("")}<th>Safeguard</th><th>Status</th></tr>
      ${S.decisions.map(d => { const tests = M.graduationTests(d), pass = tests.every(t => t.ok), demote = d.cur === 0 && d.overrides > 20; return `<tr class="click" data-act="decision" data-id="${d.id}"><td>${esc(d.name)}</td>${[0, 1, 2, 3].map(c => `<td class="c">${dot(d, c)}</td>`).join("")}<td style="color:var(--sub)">${esc(d.guard)}</td><td>${demote ? `<span class="tag bad">Demote</span>` : d.cur === 1 ? (pass ? `<span class="tag good">Ready</span>` : `<span class="tag plain">${tests.filter(t => t.ok).length}/5 tests</span>`) : d.cur === 0 ? `<span class="tag info">Automated</span>` : `<span class="tag plain">${d.cur === 3 ? "Leadership" : "Human"}</span>`}</td></tr>`; }).join("")}</table></div></section></div>`;
    },
    pilots() {
      return `<div class="ph"><div><h1>Pilot gates</h1><p>Two 16-week pilots against control groups. All gates met two months running means scale. A missed gate means fix and re-run for 8 weeks. Change the blue numbers to test the call.</p></div></div>
      <div class="grid g2">${S.pilots.map((p, pi) => { const r = gateResult(p); return `<section class="panel"><h2>${p.id}: ${esc(p.name)} <small>${esc(p.what)}</small></h2><div class="pb"><dl class="kv"><dt>Scope</dt><dd>${esc(p.scope)}</dd><dt>Control group</dt><dd>${esc(p.control)}</dd><dt>Week of 16</dt><dd><input class="cell" type="number" min="0" max="16" value="${p.week}" data-input="pilot" data-path="${pi}.week" aria-label="Week"></dd><dt>Months all gates met</dt><dd><input class="cell" type="number" min="0" max="6" value="${p.months}" data-input="pilot" data-path="${pi}.months" aria-label="Months"></dd></dl></div>
      <div class="pb flush"><table class="t"><tr><th>Gate at week 16</th><th>Before</th><th class="r">Target</th><th class="r">Actual</th><th>Result</th></tr>${p.gates.map((g, gi) => `<tr><td>${esc(g.l)}</td><td style="color:var(--sub)">${esc(g.today)}</td><td class="r">${g.dir > 0 ? "≥" : "≤"} ${g.t}${g.u}</td><td class="r"><input class="cell" type="number" step="0.5" value="${g.v}" data-input="pilot" data-path="${pi}.gates.${gi}.v" aria-label="${esc(g.l)}"></td><td id="g${pi}_${gi}">${gateTag(g)}</td></tr>`).join("")}</table></div><div id="pv${pi}" class="verdict ${r.cls}">${r.text}</div></section>`; }).join("")}</div>`;
    },
    value() {
      const a = S.value;
      const SL = [["inv_days", "Days of stock removed", 0, 10, 0.5, v => v + " d"], ["frag_share", "Volume in fragmented lots", 0, 0.3, 0.01, pct], ["consol", "Premium removed by pooling", 0, 1, 0.05, pct], ["constr_share", "Constrained-grade share", 0, 0.2, 0.01, pct], ["alloc_uplift", "Allocation uplift, ₹/t", 0, 1500, 50, v => num(v)], ["mix_shift", "Volume moved to value-added", 0, 0.02, 0.0005, v => (v * 100).toFixed(2) + "%"], ["stop_events", "Line-stop episodes a year", 0, 15, 1, v => v], ["age_flow", "Tonnes ageing a year", 0, 100000, 5000, v => num(v)], ["age_prevent", "Ageing prevented", 0, 1, 0.05, pct], ["fte_free", "Planner capacity freed", 0, 0.5, 0.05, pct], ["capex", "Build cost, ₹ Cr", 50, 300, 10, v => v], ["run", "Run cost, ₹ Cr a year", 10, 80, 5, v => v]];
      return `<div class="ph"><div><h1>Value tracker</h1><p>The Q5 model, live. Move any assumption and see EBITDA, cash and NPV. NPV counts the stock cash once and never adds its carrying saving.</p></div><div class="row"><button class="btn sm alt" data-act="vcase" data-c="LOW">Low case</button><button class="btn sm alt" data-act="vcase" data-c="BASE">Base case</button><button class="btn sm alt" data-act="vcase" data-c="HIGH">High case</button></div></div>
      <div class="grid g-value" style="align-items:start"><section class="panel"><h2>Assumptions</h2><div class="pb">${SL.map(([k, l, mn, mx, st, f]) => `<label class="slider"><span>${l}</span><output id="o_${k}">${f(a[k])}</output><input type="range" min="${mn}" max="${mx}" step="${st}" value="${a[k]}" data-input="value" data-key="${k}" aria-label="${l}"></label>`).join("")}</div></section><div id="valueResults">${valueResults()}</div></div>`;
      function pct(v) { return Math.round(v * 100) + "%"; }
    },
    customer() {
      const list = S.orders.filter(o => o.confirm != null);
      if (!UI.customer || !list.find(o => o.id === UI.customer)) UI.customer = list[0].id;
      const v = view(S.orders.find(o => o.id === UI.customer)), o = v.o, eta = v.conf >= 0.9 ? "±3 h" : v.conf >= 0.8 ? "±6 h" : "±12 h";
      const st = [["Confirmed", o.confirm], ["Produced", o.produced], ["Dispatched", o.dispatch], ["In transit", null], ["Delivered", o.eta]], idx = { Committed: 0, Produced: 1, "In transit": 3, Delivered: 4 }[v.stage];
      return `<div class="ph"><div><h1>Customer view</h1><p>What the customer sees on the order portal: one promise, one live date, and a warning before a miss rather than after it.</p></div>
        <label class="filters" style="margin:0">Order <select data-input="customer" aria-label="Order">${list.map(x => `<option value="${x.id}" ${x.id === UI.customer ? "selected" : ""}>${x.id}, ${esc(x.customer)}</option>`).join("")}</select></label></div>
      <div class="phone"><div class="hd"><small>My orders</small><div class="o">Order ${o.id}</div><small>${num(o.t)} t ${esc(o.grade)} to ${nodeName(o.dest)}</small><div class="eta"><small>${v.done ? "Delivered" : "Expected arrival"}</small><b>${when(o.eta)}</b>${v.done ? "" : `<small>${eta} accuracy</small>`}</div></div><div class="pb2">${v.p >= 0.5 ? `<div class="verdict warn" style="margin-bottom:8px;font-size:13px">We expect this to arrive after the promised ${when(o.promise)}. Your account owner is already working on it.</div>` : ""}<ul class="steps">${st.map(([n, t], i) => `<li class="${i < idx || v.done ? "done" : i === idx ? "now" : ""}"><i></i><div>${n}<small>${n === "In transit" ? (v.stage === "In transit" ? "last seen via " + esc(o.mode === "Rail" ? "rail status" : v.signal.label) : "") : t != null ? when(t) : ""}</small></div></li>`).join("")}</ul></div></div>`;
    },
    audit() {
      return `<div class="ph"><div><h1>Audit trail</h1><p>Every approval and override in this session, with who, when and why.</p></div><button class="btn alt" data-act="csv">Download CSV</button></div>
      <section class="panel"><div class="pb flush wide"><table class="t"><tr><th>When</th><th>Who</th><th>Decision</th><th>Reason / detail</th></tr>${S.audit.map(a => `<tr><td style="white-space:nowrap">${when(a.t)}</td><td>${esc(a.who)}</td><td>${esc(a.what)}</td><td>${esc(a.why)}</td></tr>`).join("") || `<tr><td colspan="4">No decisions yet. Accept an exception or approve an allocation.</td></tr>`}</table></div></section>`;
    }
  };

  function nodeName(id) { const n = S.nodes.find(x => x.id === id); return n ? n.label : id; }
  function lotValue(l) { return (l.kt * 1000 * 65000 * 0.1) / 1e7; }
  function ordersTable(list) {
    return `<table class="t"><tr><th>Order</th><th>Customer</th><th>Tier</th><th>Grade</th><th class="r">Tonnes</th><th>Stage</th><th>Promise</th><th>ETA</th><th class="r">Slack h</th><th>Late risk</th></tr>
    ${list.map(v => `<tr class="click" data-act="order" data-id="${v.o.id}"><td>${v.o.id}</td><td>${esc(v.o.customer)}</td><td>${tierTag(v.o.tier)}</td><td>${esc(v.o.grade)}</td><td class="r">${num(v.o.t)}</td><td>${v.stage}</td><td>${v.o.confirm == null ? "asked " + when(v.o.promise) : when(v.o.promise)}</td><td>${when(v.o.eta)}</td><td class="r">${v.slack == null ? "-" : Math.round(v.slack)}</td><td>${v.o.confirm == null ? `<span class="tag plain">No date yet</span>` : v.done ? `<span class="tag ${v.onTime ? "good" : "bad"}">${v.onTime ? "On time" : "Late"}</span>` : riskTag(v.p)}</td></tr>`).join("") || `<tr><td colspan="10">No orders match.</td></tr>`}</table>`;
  }
  function allocResults() {
    const s = S.alloc, r = M.solve(s), rows = r.final.rows, St = r.stretch, ours = r.options.find(o => o.ours), done = S.allocDecision;
    const maxV = Math.max(...r.options.map(o => Math.abs(o.value)), 1);
    return `<div class="grid" style="align-content:start">
      <section class="panel"><h2>Decision</h2><div class="pb flush wide"><table class="t"><tr><th>Customer</th><th>Rule</th><th class="r">Mill KT</th><th class="r">SPC KT</th><th class="r">Short KT</th><th class="r">₹ Cr</th><th>Note</th></tr>
      ${rows.map(x => `<tr><td><b>${esc(x.c.name)}</b></td><td><span class="tag info">${esc(x.rule || "-")}</span></td><td class="r">${x.mill.toFixed(2)}</td><td class="r">${x.net ? x.net.toFixed(2) : "-"}</td><td class="r">${x.short > 1e-9 ? x.short.toFixed(2) : "-"}</td><td class="r">${x.value.toFixed(2)}</td><td>${x.lineStop ? `<span class="tag bad">Line stops</span>` : x.bridge ? `<span class="tag warn">Bridge by road until day ${x.end.toFixed(0)}</span>` : x.short > 1e-9 && x.c.tier === "C" ? "Seek LC amendment" : ""}</td></tr>`).join("")}
      <tr class="total"><td>Total</td><td></td><td class="r">${rows.reduce((a, x) => a + x.mill, 0).toFixed(2)}</td><td class="r">${rows.reduce((a, x) => a + x.net, 0).toFixed(2)}</td><td class="r">${rows.reduce((a, x) => a + x.short, 0).toFixed(2)}</td><td class="r">${ours.value.toFixed(2)}</td><td>${r.final.stop ? "after ₹" + r.final.stop + " Cr stoppage" : r.extend ? "after extension cost" : ""}</td></tr></table></div></section>
      <section class="panel"><h2>Campaign sequence</h2><div class="pb">${gantt(r, s)}</div></section>
      <div class="grid g2"><section class="panel"><h2>Four ways to decide, ₹ Cr</h2><div class="pb">${hbars(r.options.slice().sort((a, b) => a.value - b.value).map(o => ({ l: o.name, v: o.value, t: o.value.toFixed(2), c: o.ours ? "#0F2D5C" : "#9DB7E0", bold: o.ours, tip: o.note })), { w: 400, lw: 136, rh: 26, aria: "Value by decision method" })}<p class="note">Our rule is ${r.swing >= 0 ? "ahead of" : "behind"} the next-best option by ₹${Math.abs(r.swing).toFixed(2)} Cr.</p></div></section>
      <section class="panel"><h2>Stretch test: extend by ${s.extension} KT?</h2><div class="pb"><dl class="kv"><dt>Cost of extending</dt><dd>${cr(St.cost)}</dd><dt>Hurdle</dt><dd>₹${num(St.hurdle)} per tonne</dd><dt>Gain from extra tonnes</dt><dd>${cr(St.gain)}</dd><dt>Net effect</dt><dd><b>${cr(St.net)}</b></dd></dl><div class="verdict ${r.extend ? "warn" : "good"}" style="margin-top:8px">${r.extend ? "Extend the campaign" : "Do not extend"}</div></div></section></div>
      <section class="panel"><h2>Who decides</h2><div class="pb"><div class="row spread"><div>${r.escalate.length ? `<b>Escalate to ${esc(r.approver)}:</b> ${esc(r.escalate.join("; "))}.` : `<b>${esc(r.approver)} can approve alone</b>, within policy.`}</div><div class="row">${done ? `<span class="tag ${done.type === "Approved" ? "good" : "warn"}">${esc(done.type)} ${when(done.at)}</span>` : ""}<button class="btn" data-act="alloc-approve">Approve</button><button class="btn alt" data-act="override" data-id="ALLOC">Override</button></div></div></div></section></div>`;
  }
  function valueResults() {
    const a = S.value, C = M.cashflow(a), L = C.levers;
    return `<div class="grid" style="align-content:start"><div class="kpis k4">
      <div class="kpi"><div class="l">Recurring EBITDA</div><div class="v">₹${num(L.recurring)} Cr</div><div class="d">per year from FY29</div></div>
      <div class="kpi"><div class="l">One-time cash</div><div class="v">₹${num(L.oneTime)} Cr</div><div class="d">stock release, counted once</div></div>
      <div class="kpi ${C.npv > 0 ? "good" : "bad"}"><div class="l">5-year NPV at 11%</div><div class="v">₹${num(C.npv)} Cr</div><div class="d">₹${num(C.recurringNpv)} Cr from recurring value alone</div></div>
      <div class="kpi"><div class="l">Payback</div><div class="v">${esc(C.payback)}</div><div class="d">recurring value only</div></div></div>
      <div class="grid g2"><section class="panel"><h2>FY29 benefit by lever, ₹ Cr a year</h2><div class="pb">${waterfall(L)}</div></section><section class="panel"><h2>Net cash flow, ₹ Cr</h2><div class="pb">${flowsChart(C.flows)}</div></section></div>
      <section class="panel"><h2>What moves NPV, ₹ Cr against this case</h2><div class="pb">${tornadoChart(M.tornado(a))}</div></section></div>`;
  }
  function gatePass(g) { return g.dir > 0 ? g.v >= g.t : g.v <= g.t; }
  function gateTag(g) { return gatePass(g) ? `<span class="tag good">Met</span>` : `<span class="tag bad">Missed</span>`; }
  function gateResult(p) {
    const miss = p.gates.filter(g => !gatePass(g)).length;
    if (p.week < 16) return { cls: "warn", text: `In progress: week ${p.week} of 16. Decision at week 16.` };
    if (miss) return { cls: "bad", text: `No-go: ${miss} gate${miss > 1 ? "s" : ""} missed. Fix and re-run for 8 weeks.` };
    if (p.months < 2) return { cls: "warn", text: `All gates met. Hold until met two months running (${p.months} so far).` };
    return { cls: "good", text: "Go: all gates met two months running. Scale up." };
  }

  // ---------------------------------------------------------------- drawers
  function openDrawer(type, id) { DR = { type, id }; drawDrawer(); $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false"); $("#scrim").classList.add("open"); }
  function closeDrawer() { DR = null; $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true"); $("#scrim").classList.remove("open"); }
  function shell(title, sub, body) { return `<header><div><h3>${esc(title)}</h3><small>${esc(sub)}</small></div><button data-act="close" aria-label="Close">×</button></header><div class="body">${body}</div>`; }
  function drawDrawer() {
    if (!DR) return;
    const el = $("#drawer");
    if (DR.type === "order") el.innerHTML = orderDrawer();
    if (DR.type === "override") el.innerHTML = overrideDrawer();
    if (DR.type === "decision") el.innerHTML = decisionDrawer();
  }
  function orderDrawer() {
    const o = S.orders.find(x => x.id === DR.id), v = view(o), a = S.alerts[o.id], pb = playbook(o), n = approverFor(pb);
    const c5 = [["Capture", when(o.created), true], ["Confirm", o.confirm != null ? `${when(o.confirm)}, ${hoursMins(o.confirm - o.created)} after order` : "Waiting for a date", o.confirm != null], ["Commit", o.produced != null ? `Produced ${when(o.produced)}` : "-", v.stage !== "Awaiting date" && v.stage !== "Committed"], ["Comply", o.dispatch != null ? `Dispatched ${when(o.dispatch)}` : "-", v.stage === "In transit" || v.done], ["Communicate", o.eta != null ? `Customer sees ${when(o.eta)}` : "-", v.done]];
    const firstOpen = c5.findIndex(s => !s[2]);
    return shell(o.id + ", " + o.customer, `${o.grade}, ${num(o.t)} t, ${nodeName(o.origin)} to ${nodeName(o.dest)}`, `
      <dl class="kv"><dt>Tier</dt><dd>${tierTag(o.tier)}</dd><dt>Owner</dt><dd>${esc(D.OWNER[D.SEGMENTS[o.seg]])}</dd><dt>Stage</dt><dd>${v.stage}</dd><dt>Promised</dt><dd>${when(o.promise)}</dd><dt>Current ETA</dt><dd>${when(o.eta)}</dd><dt>Late risk</dt><dd>${o.confirm == null ? "-" : v.done ? (v.onTime ? "Delivered on time" : "Delivered late") : riskTag(v.p)}</dd><dt>Value at risk</dt><dd>${cr(v.var)}</dd>${o.cover ? `<dt>Days of cover</dt><dd>${o.cover.toFixed(1)}</dd>` : ""}<dt>Part-loads</dt><dd>${o.lots}</dd></dl>
      ${o.confirm == null ? `<h4>Confirm a date</h4><p class="note">The tower checks stock and the campaign plan, then proposes a date inside the IBP envelope.</p><div class="row mt"><button class="btn" data-act="confirm" data-id="${o.id}">Confirm with proposed date</button></div>` : ""}
      ${a && a.status === "open" && !v.done ? `<h4>Recommended action: ${esc(pb.key)}</h4><div>${esc(pb.text)}.</div><p class="note">Pulls the ETA in by about ${pb.hours} h. ${pb.lakh < 0 ? "Saves ₹" + Math.abs(pb.lakh).toFixed(1) + " lakh of premium freight." : "Costs about ₹" + pb.lakh.toFixed(1) + " lakh."}${n ? " Above the ₹2 lakh expedite limit, so this goes to the Commit Room." : ""}</p><div class="row mt"><button class="btn" data-act="accept" data-id="${o.id}">Accept</button><button class="btn alt" data-act="override" data-id="${o.id}">Override</button></div>` : ""}
      ${a && a.status !== "open" ? `<h4>Decision</h4><div>${a.status === "accepted" ? "Playbook accepted" : "Overridden"} by ${esc(a.by)} at ${when(a.at)}${a.reason ? ": " + esc(a.reason) : ""}.</div>` : ""}
      <h4>Journey, on the 5C engine</h4><ul class="steps">${c5.map((s, i) => `<li class="${s[2] ? "done" : i === firstOpen ? "now" : ""}"><i></i><div>${s[0]}<small>${s[1]}</small></div></li>`).join("")}</ul>
      ${v.stage === "In transit" && o.mode === "Road" ? `<h4>Where is the truck?</h4><p class="note" style="margin-top:0">Switch a feed off. The tower falls back to the next-best signal and the confidence changes.</p><div class="ladder mt">${M.SIGNALS.map(s => `<label><input type="checkbox" data-input="sig" data-id="${o.id}" data-sig="${s.id}" ${o.sig[s.id] ? "checked" : ""} ${s.id === "call" ? "disabled" : ""}><span>${s.label}${v.signal.id === s.id ? " <b>(in use)</b>" : ""}</span><span style="text-align:right">${Math.round(s.confidence * 100)}%</span></label>`).join("")}</div>` : ""}
      ${o.confirm != null ? `<div class="row mt"><a class="btn alt" href="#customer" data-act="seecust" data-id="${o.id}">See customer view</a></div>` : ""}`);
  }
  function overrideDrawer() {
    return shell("Override the recommendation", DR.id === "ALLOC" ? "Constrained allocation" : "Order " + DR.id, `<p style="margin-top:0">Every override needs a reason code. The monthly review uses these to retrain the models.</p>
      <div class="ladder">${REASONS.map((r, i) => `<label style="grid-template-columns:18px 1fr"><input type="radio" name="reason" value="${esc(r)}" ${i ? "" : "checked"}><span>${esc(r)}</span></label>`).join("")}</div>
      <h4>Note (optional)</h4><input id="ovnote" style="width:100%;padding:6px;border:1px solid var(--pale)" maxlength="140" aria-label="Note"><div class="row mt"><button class="btn" data-act="override-confirm">Record override</button><button class="btn alt" data-act="close">Cancel</button></div>`);
  }
  function decisionDrawer() {
    const d = S.decisions[DR.id], tests = M.graduationTests(d), pass = tests.every(t => t.ok), can = d.cur === 1, demote = d.cur === 0 && d.overrides > 20;
    const inp = (k, st, l) => `<label>${l}<input class="cell" type="number" step="${st}" value="${d[k]}" data-input="dec" data-id="${d.id}" data-k="${k}" aria-label="${l}"></label>`;
    return shell(d.name, "Now: " + CLASSES[d.cur] + ". FY29 target: " + CLASSES[d.fy29], `<p style="margin-top:0">Safeguard: ${esc(d.guard)}.</p>
      ${d.cur <= 1 ? `<div class="fields">${inp("accept", 1, "Accepted %")}${inp("weeks", 1, "Weeks running")}${inp("n", 10, "Decisions seen")}${inp("vsHuman", 1, "Vs human, pts")}${inp("conf", 1, "Data confidence %")}${inp("stake", 1, "At stake ₹ lakh")}${inp("overrides", 1, "Overrides %")}<label>Reversible in 24 h<input type="checkbox" data-input="dec" data-id="${d.id}" data-k="reversible" ${d.reversible ? "checked" : ""}></label></div>
      <h4>Graduation tests</h4><div id="dt">${testsTable(tests)}</div>` : `<p class="note">This decision stays with a named human. It is not a candidate for automation.</p>`}
      <div class="row mt">${can ? `<button class="btn" data-act="graduate" ${pass ? "" : "disabled"}>Move to Automated</button>` : ""}${d.cur === 0 && d.fy27 === 1 ? `<button class="btn ${demote ? "" : "alt"}" data-act="demote">Move back to AI-assisted</button>` : ""}</div>${demote ? `<div class="verdict bad mt">Overrides above 20%: this decision should move back.</div>` : ""}`);
  }
  const testsTable = tests => `<table class="t"><tr><th>Test</th><th>Now</th><th>Needs</th><th></th></tr>${tests.map(t => `<tr><td>${esc(t.label)}</td><td>${esc(t.have)}</td><td>${esc(t.need)}</td><td>${t.ok ? `<span class="tag good">Pass</span>` : `<span class="tag bad">Fail</span>`}</td></tr>`).join("")}</table>`;

  // ---------------------------------------------------------------- actions
  function accept(id) {
    const o = S.orders.find(x => x.id === id), a = S.alerts[id], pb = playbook(o), before = view(o).p, by = approverFor(pb) || roleName();
    o.eta = Math.max(S.clock + 2, o.eta - pb.hours);
    if (pb.key === "Pool loads") o.lots = Math.max(2, Math.ceil(o.lots / 2));
    if (pb.lot) { const l = S.lots.find(x => !x.done && x.match === o.customer && Math.abs(x.kt * 1000 - o.t) < 1); if (l) doMatch(l, true); }
    a.status = "accepted"; a.at = S.clock; a.by = by;
    log(`Accepted ${pb.key} on ${o.id} (${o.customer})`, `${pb.text}. Late risk ${Math.round(before * 100)}% to ${Math.round(view(o).p * 100)}%.`, by);
    toast(`${pb.key} accepted. Late risk fell from ${Math.round(before * 100)}% to ${Math.round(view(o).p * 100)}%.`);
    render();
  }
  function doMatch(l, quiet) {
    if (l.done) return;
    l.done = true; const n = S.nodes.find(x => x.id === l.node); n.stock = Math.max(0, +(n.stock - l.kt).toFixed(1)); S.recovered += lotValue(l);
    log(`Matched ${l.id} to ${l.match}`, `${l.kt.toFixed(1)} KT, ${l.age} days old. Loss avoided ${cr(lotValue(l))}.`);
    if (!quiet) toast(`${l.id} matched to ${l.match}. ${cr(lotValue(l))} of discount avoided.`);
  }
  function confirmOrder(id) {
    const o = S.orders.find(x => x.id === id), base = S.nodes.find(n => n.id === o.dest).stock > 100 ? 36 : 60;
    o.confirm = Math.max(o.created + 0.5, S.clock + 0.2); o.produced = S.clock + base * 0.4; o.dispatch = S.clock + base; o.eta = o.dispatch + 40; o.promise = o.eta + 24;
    log(`Confirmed ${o.id} (${o.customer})`, `Date ${when(o.promise)}, ${hoursMins(o.confirm - o.created)} after order.`);
    toast(`${o.id} confirmed for ${when(o.promise)}.`);
    render();
  }
  function tick(h) {
    for (let i = 0; i < h; i++) {
      S.clock += 1;
      S.orders.forEach((o, idx) => {
        const v = view(o);
        if (v.stage === "In transit" && !(S.alerts[o.id] && S.alerts[o.id].status !== "open") && D.rng(S.clock * 1000 + idx)() < 0.012) { const add = 8 + Math.round(D.rng(S.clock * 77 + idx)() * 18); o.eta += add; log(`ETA slipped on ${o.id}`, `${add} h later, seen via ${v.signal.label}.`, "Tower"); }
      });
      syncAlerts();
      Object.keys(S.alerts).forEach(id => { const a = S.alerts[id]; if (a.status !== "open") return; const l = levelOf(a); if (l > a.level) { a.level = l; const o = S.orders.find(x => x.id === id); if (!view(o).done) log(`Escalated ${id} to ${LEVELS[l]}`, "Clock ran out.", "Tower"); } });
    }
    toast(`Time moved to ${when(S.clock)}.`);
    render();
  }

  function preset(p) {
    const s = clone(M.EXHIBIT8);
    if (p === "disp") s.displaced = 0;
    if (p === "spc") s.network.kt = 0;
    if (p === "a65") s.customers[0].need = 6.5;
    if (p === "a105") s.customers[0].need = 10.5;
    if (p === "exp") s.customers[3].margin = 40000;
    S.alloc = s; S.allocDecision = null; render();
  }
  function setPath(obj, path, val) { const k = path.split("."); let o = obj; for (let i = 0; i < k.length - 1; i++) o = o[k[i]]; o[k[k.length - 1]] = val; }

  document.addEventListener("click", ev => {
    const t = ev.target.closest("[data-act]"); if (!t) return;
    const a = t.dataset.act;
    if (a === "seecust") { UI.customer = t.dataset.id; closeDrawer(); return; }
    if (t.tagName === "A") return;
    if (["accept", "override"].includes(a)) ev.stopPropagation();
    if (a === "tick") tick(+t.dataset.h);
    if (a === "reset") { if (confirm("Reset the demo to its starting state?")) { S = fresh(); syncAlerts(); closeDrawer(); render(); toast("Demo reset."); } }
    if (a === "close") closeDrawer();
    if (a === "order") openDrawer("order", t.dataset.id);
    if (a === "decision") openDrawer("decision", +t.dataset.id);
    if (a === "accept") { accept(t.dataset.id); if (DR && DR.type === "order") drawDrawer(); }
    if (a === "override") openDrawer("override", t.dataset.id);
    if (a === "override-confirm") {
      const reason = ($('input[name="reason"]:checked') || {}).value + (($("#ovnote").value || "").trim() ? " - " + $("#ovnote").value.trim() : "");
      if (DR.id === "ALLOC") { S.allocDecision = { type: "Overridden", at: S.clock }; log("Overrode the 4R allocation", reason); }
      else { Object.assign(S.alerts[DR.id], { status: "overridden", at: S.clock, by: roleName(), reason }); log(`Overrode recommendation on ${DR.id}`, reason); }
      toast("Override recorded with its reason."); closeDrawer(); render();
    }
    if (a === "confirm") { confirmOrder(t.dataset.id); drawDrawer(); }
    if (a === "match") { doMatch(S.lots.find(l => l.id === t.dataset.id)); render(); }
    if (a === "preset") preset(t.dataset.p);
    if (a === "alloc-approve") { const r = M.solve(S.alloc), v = r.options.find(o => o.ours).value; S.allocDecision = { type: "Approved", at: S.clock }; log("Approved the 4R allocation", `${r.final.rows.map(x => x.c.name + " " + x.gets.toFixed(1) + " KT").join(", ")}. Net ${cr(v)}. ${r.extend ? "Campaign extended." : "No extension."}`, r.approver); toast("Allocation approved and logged. Customers get their dates today."); render(); }
    if (a === "vcase") { S.value = clone(M[t.dataset.c]); render(); }
    if (a === "graduate") { const d = S.decisions[DR.id]; d.cur = 0; log(`Moved "${d.name}" to Automated`, "All five graduation tests passed."); render(); drawDrawer(); toast("Decision moved to Automated."); }
    if (a === "demote") { const d = S.decisions[DR.id]; d.cur = 1; log(`Moved "${d.name}" back to AI-assisted`, `Overrides at ${d.overrides}%.`); render(); drawDrawer(); }
    if (a === "csv") { const rows = [["When", "Who", "Decision", "Detail"]].concat(S.audit.map(x => [when(x.t), x.who, x.what, x.why])); const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(",")).join("\n"); const u = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); const l = document.createElement("a"); l.href = u; l.download = "vachan-audit-trail.csv"; l.click(); URL.revokeObjectURL(u); }
    if (["accept", "override-confirm", "confirm", "match", "preset", "alloc-approve", "vcase", "graduate", "demote", "tick", "reset"].includes(a)) save();
  });

  function onInput(ev) {
    const t = ev.target, k = t.dataset && t.dataset.input; if (!k) return;
    if (k === "q" || k === "tier" || k === "stage" || k === "onlyRisk") {
      UI[k] = t.type === "checkbox" ? t.checked : t.value;
      if (k === "q") { const html = VIEWS.orders(); const d = document.createElement("div"); d.innerHTML = html; $("#ordersTable").innerHTML = $("#ordersTable", d).innerHTML; $("#count").textContent = $("#count", d).textContent; } else render();
      return;
    }
    if (k === "customer") { UI.customer = t.value; render(); return; }
    if (k === "alloc") { const v = t.tagName === "SELECT" ? t.value : (t.value === "" ? 0 : +t.value); setPath(S.alloc, t.dataset.path, v); S.allocDecision = null; $("#allocResults").innerHTML = allocResults(); save(); return; }
    if (k === "value") { S.value[t.dataset.key] = +t.value; const f = VIEWS.value(); const d = document.createElement("div"); d.innerHTML = f; $("#o_" + t.dataset.key).textContent = $("#o_" + t.dataset.key, d).textContent; $("#valueResults").innerHTML = valueResults(); save(); return; }
    if (k === "pilot") { setPath(S.pilots, t.dataset.path, +t.value); const i = +t.dataset.path.split(".")[0], p = S.pilots[i], r = gateResult(p), pv = $("#pv" + i); pv.className = "verdict " + r.cls; pv.textContent = r.text; p.gates.forEach((g, gi) => { $(`#g${i}_${gi}`).innerHTML = gateTag(g); }); save(); return; }
    if (k === "sig") { const o = S.orders.find(x => x.id === t.dataset.id); o.sig[t.dataset.sig] = t.checked; const v = view(o); log(`${t.checked ? "Restored" : "Lost"} ${t.dataset.sig.toUpperCase()} feed on ${o.id}`, `Now located by ${v.signal.label}, confidence ${Math.round(v.conf * 100)}%.`, "Tower"); syncAlerts(); drawDrawer(); render(); save(); return; }
    if (k === "dec") { const d = S.decisions[+t.dataset.id]; d[t.dataset.k] = t.type === "checkbox" ? t.checked : +t.value; if (ev.type === "change" || t.type === "checkbox") { render(); drawDrawer(); } else { const dt = $("#dt"); if (dt) dt.innerHTML = testsTable(M.graduationTests(d)); } save(); }
  }
  document.addEventListener("input", onInput);
  document.addEventListener("change", ev => { const t = ev.target; if (t.dataset && (t.tagName === "SELECT" || t.type === "checkbox" || t.dataset.input === "dec") && t.dataset.input && !["alloc"].includes(t.dataset.input) && ev.type === "change" && t.dataset.input === "dec") onInput(ev); });

  $("#role").innerHTML = `<option value="All">Control tower lead</option>` + D.SEGMENTS.map(s => `<option value="${esc(s)}">${esc(D.OWNER[s])}</option>`).join("");
  $("#role").addEventListener("change", e => { S.role = e.target.value; save(); render(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeDrawer(); });

  const tip = $("#tip");
  document.addEventListener("mousemove", e => {
    const t = e.target.closest && e.target.closest("[data-tip]");
    if (!t) { tip.style.display = "none"; return; }
    tip.textContent = t.getAttribute("data-tip"); tip.style.display = "block";
    const w = tip.offsetWidth; tip.style.left = Math.min(e.clientX + 12, innerWidth - w - 8) + "px"; tip.style.top = (e.clientY + 14) + "px";
  });

  const NAV = [["overview", "Overview"], ["orders", "Orders"], ["exceptions", "Exceptions"], ["allocation", "Allocation"], ["network", "Network"], ["decisions", "Decision rights"], ["pilots", "Pilot gates"], ["value", "Value tracker"], ["customer", "Customer view"], ["audit", "Audit trail"]];
  function route() { const r = location.hash.slice(1); return VIEWS[r] ? r : "overview"; }
  function render() {
    syncAlerts();
    const r = route();
    $("#main").innerHTML = VIEWS[r]();
    $("#nav").innerHTML = NAV.map(([k, l]) => { const n = k === "exceptions" ? openEx().length : 0; return `<a href="#${k}" class="${k === r ? "on" : ""}" ${k === r ? 'aria-current="page"' : ""}>${l}${n ? `<span class="n">${n}</span>` : ""}</a>`; }).join("");
    $("#clock").textContent = "Simulated time: " + when(S.clock);
    $("#role").value = S.role;
    mountMap();
    save();
  }
  window.addEventListener("hashchange", () => { closeDrawer(); render(); window.scrollTo(0, 0); });
  render();
  // hooks for the automated browser test
  window.__vachan = { state: () => S, kpis };
})();
