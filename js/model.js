/* VACHAN decision engine and value model. Pure functions, no DOM. */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------- value model
  const CASE = { volume: 20e6, nsr: 65000, stockCost: 53000, coc: 0.11, freight: 2500, cr: 1e7, poolT: 22500, poolRecover: 0.5, stopCr: 3 };
  const BASE = { inv_days: 5, frag_share: 0.15, frag_prem: 0.2, consol: 0.5, constr_share: 0.08, alloc_uplift: 600, mix_shift: 0.005, mix_delta: 8000, stop_events: 8, stop_avoid: 0.75, age_flow: 60000, age_loss: 0.1, age_prevent: 0.6, fte: 400, fte_free: 0.25, fte_cost: 18e5, capex: 140, run: 30 };
  const LOW = Object.assign({}, BASE, { inv_days: 3, frag_share: 0.1, consol: 0.35, constr_share: 0.05, alloc_uplift: 300, mix_shift: 0.0025, stop_events: 5, age_flow: 30000, age_prevent: 0.4, fte_free: 0.15 });
  const HIGH = Object.assign({}, BASE, { inv_days: 7, frag_share: 0.2, consol: 0.6, constr_share: 0.12, alloc_uplift: 1170, mix_shift: 0.01, stop_events: 10, age_flow: 80000, age_prevent: 0.75, fte_free: 0.3 });
  const YEARS = ["FY27", "FY28", "FY29", "FY30", "FY31"];
  const RAMP = [0.05, 0.45, 1, 1, 1], CASH = [0, 0.4, 0.6, 0, 0], CAPEX = [0.25, 0.5, 0.25, 0, 0], RUN = [0.3, 0.8, 1, 1, 1];

  function levers(a) {
    const C = CASE;
    const invCash = (a.inv_days * C.volume) / 365 * C.stockCost / C.cr;
    const carrying = invCash * C.coc;
    const logistics = (C.volume * a.frag_share * C.freight * a.frag_prem * a.consol) / C.cr;
    const allocation = (C.volume * a.constr_share * a.alloc_uplift) / C.cr;
    const mix = (C.volume * a.mix_shift * a.mix_delta) / C.cr + a.stop_events * C.stopCr * a.stop_avoid;
    const highAge = (a.age_flow * C.nsr * a.age_loss * a.age_prevent) / C.cr;
    const productivity = (a.fte * a.fte_free * a.fte_cost) / C.cr;
    const poolCash = (C.poolT * C.nsr * a.age_loss * C.poolRecover) / C.cr;
    const recurring = logistics + allocation + mix + highAge + productivity;
    return { invCash, carrying, logistics, allocation, mix, highAge, productivity, poolCash, recurring, totalPL: recurring + carrying, oneTime: invCash + poolCash };
  }

  function cashflow(a, opts) {
    const o = Object.assign({ delay: 0, costMult: 1 }, opts);
    const L = levers(a);
    const flows = [], recurringFlows = [];
    let npv = 0, recurringNpv = 0;
    YEARS.forEach((y, i) => {
      const r = RAMP[i] * (1 - o.delay) + (i ? RAMP[i - 1] : 0) * o.delay;
      const c = CASH[i] * (1 - o.delay) + (i ? CASH[i - 1] : 0) * o.delay;
      const cost = o.costMult * (a.capex * CAPEX[i] + a.run * RUN[i]);
      const f = L.recurring * r + L.oneTime * c - cost;
      const rf = L.recurring * r - cost;
      const df = 1 / Math.pow(1 + CASE.coc, i + 0.5);
      flows.push(f); recurringFlows.push(rf);
      npv += f * df; recurringNpv += rf * df;
    });
    let cum = 0, payback = "after FY31";
    const months = [6, 18, 30, 42, 54];
    for (let i = 0; i < YEARS.length; i++) { cum += recurringFlows[i]; if (cum > 0) { payback = "~" + months[i] + " months"; break; } }
    return { flows, recurringFlows, npv, recurringNpv, payback, levers: L };
  }

  function tornado(a) {
    const base = cashflow(a).npv;
    const drive = (keys, from) => { const x = Object.assign({}, a); keys.forEach(k => { x[k] = from[k]; }); return cashflow(x).npv - base; };
    return [
      ["Stock days cut", drive(["inv_days"], LOW), drive(["inv_days"], HIGH)],
      ["Allocation uplift", drive(["alloc_uplift", "constr_share"], LOW), drive(["alloc_uplift", "constr_share"], HIGH)],
      ["Mix shift", drive(["mix_shift"], LOW), drive(["mix_shift"], HIGH)],
      ["Freight premium removed", drive(["frag_share", "consol"], LOW), drive(["frag_share", "consol"], HIGH)],
      ["6-month adoption delay", cashflow(a, { delay: 0.5 }).npv - base, 0],
      ["Cost overrun of 50%", cashflow(a, { costMult: 1.5 }).npv - base, 0],
      ["High-age stock prevented", drive(["age_flow", "age_prevent"], LOW), drive(["age_flow", "age_prevent"], HIGH)],
      ["Penalty episodes", drive(["stop_events"], LOW), drive(["stop_events"], HIGH)]
    ];
  }

  // ---------------------------------------------------------------- 4R allocation rule
  // KT x Rs/t / 10,000 = Rs Cr
  const crOf = (kt, perT) => (kt * perT) / 10000;

  const EXHIBIT8 = {
    campaign: 10, days: 14, extension: 4, displaced: 10000, changeover: 1.5, stopCr: 3, leadTime: 3, greyZone: 0.15, escalateCr: 5,
    network: { kt: 1.5, freight: 1200, customer: "Retail" },
    customers: [
      { name: "OEM A", need: 5, margin: 18000, cover: 2, tier: "P", penaltyCr: 0, pMiss: 0 },
      { name: "OEM B", need: 3, margin: 17000, cover: 12, tier: "S", penaltyCr: 0, pMiss: 0 },
      { name: "Retail", need: 2, margin: 14000, cover: 30, tier: "F", penaltyCr: 0, pMiss: 0 },
      { name: "Export", need: 3, margin: 9000, cover: 20, tier: "C", penaltyCr: 0, pMiss: 0 }
    ]
  };

  function rvPerT(c) { return c.margin + (c.need > 0 ? (c.penaltyCr * c.pMiss * 1e7) / (c.need * 1000) : 0); }
  function isProtected(c, s) { return c.tier === "P" && c.cover < s.leadTime + 2; }

  function allocate(s, capacity, useNetwork) {
    const rows = s.customers.map(c => ({ c, mill: 0, net: 0, rule: "", start: null, end: null, rv: rvPerT(c), protected: isProtected(c, s) }));
    let left = capacity;
    const give = (r, kt, rule) => { const g = Math.max(0, Math.min(kt, left)); r.mill += g; left -= g; if (g > 0 && !r.rule) r.rule = rule; return g; };

    // 1 Protect: line-feed customers inside the trigger, tightest cover first
    rows.filter(r => r.protected).sort((a, b) => a.c.cover - b.c.cover).forEach(r => give(r, r.c.need, "Protect"));

    // 2 Re-source: network stock goes to its matching customer when the freight still leaves margin
    if (useNetwork && s.network && s.network.kt > 0) {
      const t = rows.find(r => r.c.name === s.network.customer);
      if (t && t.c.margin > s.network.freight) {
        t.net = Math.min(s.network.kt, Math.max(0, t.c.need - t.mill));
        if (t.net > 0) t.rule = "Re-source";
      }
    }

    // 3 Re-time and 4 Rank: what is left goes by risk-adjusted value per tonne
    rows.filter(r => !r.protected).sort((a, b) => b.rv - a.rv).forEach(r => {
      const want = r.c.need - r.net - r.mill;
      if (want <= 0) return;
      const rule = r.rule || (r.c.tier === "S" || r.c.tier === "P" ? "Re-time" : "Rank");
      give(r, want, rule);
      if (!r.rule) r.rule = "Rank";
    });

    // sequence on the mill: protected first, then by rank
    const rate = s.campaign / s.days;
    let clock = 0;
    rows.slice().sort((a, b) => (b.protected - a.protected) || (a.protected ? a.c.cover - b.c.cover : b.rv - a.rv)).forEach(r => {
      if (r.mill <= 0) return;
      r.start = clock; clock += r.mill / rate; r.end = clock;
    });

    return summarise(s, rows, left);
  }

  function summarise(s, rows, left) {
    let value = 0, stop = 0;
    rows.forEach(r => {
      r.gets = r.mill + r.net;
      r.value = crOf(r.mill, r.c.margin) + crOf(r.net, r.c.margin - (s.network ? s.network.freight : 0));
      r.short = Math.max(0, r.c.need - r.gets);
      r.lineStop = r.protected && r.short > 1e-9;
      r.bridge = r.protected && r.start !== null && r.end > r.c.cover;
      value += r.value;
      if (r.lineStop) stop += s.stopCr;
    });
    return { rows, value: value - stop, gross: value, stop, unusedMill: left, served: rows.reduce((a, r) => a + r.gets, 0) };
  }

  function proRata(s) {
    const total = s.customers.reduce((a, c) => a + c.need, 0);
    const share = total ? Math.min(1, s.campaign / total) : 0;
    const rows = s.customers.map(c => ({ c, mill: c.need * share, net: 0, rule: "Pro-rata", protected: isProtected(c, s) }));
    return summarise(s, rows, 0);
  }
  function byMargin(s, capacity) {
    let left = capacity;
    const rows = s.customers.map(c => ({ c, mill: 0, net: 0, rule: "Margin", protected: isProtected(c, s) }));
    rows.slice().sort((a, b) => b.c.margin - a.c.margin).forEach(r => { const g = Math.min(r.c.need, left); r.mill = g; left -= g; });
    return summarise(s, rows, left);
  }

  function extensionCost(s) { return crOf(s.extension, s.displaced) + s.changeover; }

  function solve(s) {
    const rule = allocate(s, s.campaign, true);
    const stretched = allocate(s, s.campaign + s.extension, true);
    const cost = extensionCost(s);
    const gain = stretched.value - rule.value;
    const net = gain - cost;
    const pro = proRata(s), margin = byMargin(s, s.campaign), ext = byMargin(s, s.campaign + s.extension);
    const options = [
      { name: "Pro-rata share", value: pro.value, note: pro.stop ? "a Protected line stops" : "" },
      { name: "Extend campaign", value: ext.value - cost, note: "extra " + s.extension + " KT, then rank by margin" },
      { name: "Rank by margin only", value: margin.value, note: margin.stop ? "a Protected line stops" : "" },
      { name: "4R rule", value: net > 0 ? stretched.value - cost : rule.value, note: net > 0 ? "with the campaign extended" : "no extension", ours: true }
    ];
    const others = options.filter(o => !o.ours).map(o => o.value);
    const ours = options.find(o => o.ours).value;
    const swing = ours - Math.max.apply(null, others);
    const inGrey = cost > 0 && Math.abs(gain - cost) <= s.greyZone * cost;
    const final = net > 0 ? stretched : rule;
    const escalate = [];
    if (final.rows.some(r => r.lineStop)) escalate.push("A Protected customer would still be short");
    if (inGrey) escalate.push("Stretch test is within " + Math.round(s.greyZone * 100) + "% of the hurdle");
    if (Math.abs(swing) > s.escalateCr) escalate.push("More than ₹" + s.escalateCr + " Cr swings on this call");
    const unmet = rule.rows.reduce((a, r) => a + r.short, 0);
    return {
      rule, stretched, final, extend: net > 0, options, swing,
      stretch: { cost, gain, net, hurdle: s.extension ? (cost * 10000) / s.extension : 0, unmet },
      escalate, approver: escalate.length ? "Weekly Commit Room" : "Promise Owner"
    };
  }

  // ---------------------------------------------------------------- order risk
  function lateProbability(slackHours, confidence) {
    // Less certain location data widens the band, so low confidence pushes a tight order towards "at risk"
    const k = 8 + 26 * (1 - confidence);
    const x = (slackHours - 10) / k;
    return 1 / (1 + Math.exp(x * 1.6));
  }

  const SIGNALS = [
    { id: "gps", label: "GPS on truck", confidence: 0.95 },
    { id: "fastag", label: "FASTag toll", confidence: 0.85 },
    { id: "ewb", label: "E-way bill route", confidence: 0.7 },
    { id: "call", label: "Transporter call", confidence: 0.5 }
  ];
  function bestSignal(sig) { return SIGNALS.find(s => sig[s.id]) || SIGNALS[SIGNALS.length - 1]; }

  // ---------------------------------------------------------------- decision graduation
  function graduationTests(d) {
    return [
      { label: "Advice accepted, 12 weeks", ok: d.accept >= 90 && d.weeks >= 12, have: d.accept + "%, " + d.weeks + " wk", need: "≥90%, 12 wk" },
      { label: "Decisions observed", ok: d.n >= 300, have: String(d.n), need: "≥300" },
      { label: "Result vs human control", ok: d.vsHuman >= 0, have: (d.vsHuman >= 0 ? "+" : "") + d.vsHuman + " pts", need: "≥ human" },
      { label: "Input data confidence", ok: d.conf >= 95, have: d.conf + "%", need: "≥95%" },
      { label: "At stake, reversible in 24 h", ok: d.stake <= 25 && d.reversible, have: "₹" + d.stake + " L" + (d.reversible ? "" : ", not reversible"), need: "≤₹25 L" }
    ];
  }

  const api = { CASE, BASE, LOW, HIGH, YEARS, levers, cashflow, tornado, EXHIBIT8, solve, allocate, extensionCost, lateProbability, SIGNALS, bestSignal, graduationTests };
  root.VachanModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
