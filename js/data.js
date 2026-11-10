/* Simulated demo data. Nothing here is real customer or company data. */
(function (root) {
  "use strict";
  function rng(seed) { let a = seed >>> 0; return function () { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const SEGMENTS = ["Automotive & Speciality", "Industrial & Projects", "Branded & Retail", "Enterprise & SME"];
  const OWNER = { "Automotive & Speciality": "Auto Promise Owner", "Industrial & Projects": "I&P Promise Owner", "Branded & Retail": "Retail Promise Owner", "Enterprise & SME": "Enterprise Promise Owner" };
  const NODES = [
    { id: "jsr", st: "jh", fx: 0.78, fy: 0.78, label: "Jamshedpur", kind: "Plant", stock: 300, dx: -12, dy: -12, anchor: "end" },
    { id: "kpo", st: "or", fx: 0.72, fy: 0.33, label: "Kalinganagar", kind: "Plant", stock: 260, dx: 12, dy: 4 },
    { id: "mer", st: "or", fx: 0.5, fy: 0.42, label: "Meramandali", kind: "Plant", stock: 170, dx: -12, dy: 18, anchor: "end" },
    { id: "pune", st: "mh", fx: 0.22, fy: 0.58, label: "Pune", kind: "SPC", stock: 140, dx: -12, dy: 5, anchor: "end" },
    { id: "che", st: "tn", fx: 0.82, fy: 0.14, label: "Chennai", kind: "SPC", stock: 120, dx: 10, dy: 5 },
    { id: "ncr", st: "hr", fx: 0.72, fy: 0.78, label: "NCR", kind: "SPC", stock: 150, dx: 10, dy: 5 },
    { id: "san", st: "gj", fx: 0.62, fy: 0.45, label: "Sanand", kind: "Yard", stock: 90, dx: -10, dy: 5, anchor: "end" },
    { id: "bpl", st: "mp", fx: 0.35, fy: 0.55, label: "Bhopal", kind: "SPC", stock: 90, dx: -12, dy: -10, anchor: "end" }
  ];
  const CUSTOMERS = [
    { name: "OEM A", seg: 0, tier: "P", dest: "pune", margin: 18000, grades: ["CRCA critical", "CRCA exposed"] },
    { name: "OEM B", seg: 0, tier: "S", dest: "che", margin: 17000, grades: ["CRCA critical", "GA exposed"] },
    { name: "OEM C", seg: 0, tier: "S", dest: "san", margin: 16000, grades: ["GA exposed", "HSLA"] },
    { name: "Pipe Maker", seg: 1, tier: "S", dest: "bpl", margin: 11000, grades: ["HR tube grade"] },
    { name: "EPC Contractor", seg: 1, tier: "C", dest: "ncr", margin: 10000, grades: ["HR plate", "HR structural"] },
    { name: "Export Buyer", seg: 1, tier: "C", dest: "che", margin: 9000, grades: ["HR commercial"] },
    { name: "Retail North", seg: 2, tier: "F", dest: "ncr", margin: 14000, grades: ["GP coil", "Colour coated"] },
    { name: "Retail West", seg: 2, tier: "F", dest: "san", margin: 13500, grades: ["GP coil"] },
    { name: "SME Cluster", seg: 3, tier: "F", dest: "bpl", margin: 9500, grades: ["HR commercial", "CR commercial"] },
    { name: "Fabricator Group", seg: 3, tier: "F", dest: "pune", margin: 9000, grades: ["CR commercial"] }
  ];
  const ORIGINS = ["jsr", "kpo", "mer"];

  function orders() {
    const R = rng(7), out = [];
    const pick = a => a[Math.floor(R() * a.length)];
    const mk = o => { out.push(o); return o; };
    let n = 48213;
    // the three stories from the case come first
    mk({ id: "VO-" + n++, customer: "OEM A", seg: 0, tier: "P", grade: "CRCA critical", t: 620, margin: 18000, origin: "jsr", dest: "pune", mode: "Road", created: -30, confirm: -24.3, produced: -12, dispatch: 2, eta: 58, promise: 40, lots: 2, cover: 2, penaltyCr: 3, sig: { gps: true, fastag: true, ewb: true, call: true } });
    mk({ id: "VO-" + n++, customer: "Pipe Maker", seg: 1, tier: "S", grade: "HR tube grade", t: 1450, margin: 11000, origin: "kpo", dest: "bpl", mode: "Road", created: -120, confirm: -112, produced: -80, dispatch: -40, eta: 66, promise: 30, lots: 6, cover: 0, penaltyCr: 0, sig: { gps: false, fastag: true, ewb: true, call: true } });
    mk({ id: "VO-" + n++, customer: "Retail North", seg: 2, tier: "F", grade: "GP coil", t: 1500, margin: 14000, origin: "jsr", dest: "ncr", mode: "Road", created: -40, confirm: -34, produced: 12, dispatch: 30, eta: 96, promise: 72, lots: 3, cover: 0, penaltyCr: 0, sig: { gps: true, fastag: true, ewb: true, call: true }, spc: "ncr" });
    for (let i = 0; i < 66; i++) {
      const c = pick(CUSTOMERS);
      const promise = Math.round(24 + R() * 210);
      const roll = R();
      const offset = roll < 0.74 ? -(14 + R() * 60) : roll < 0.92 ? -(R() * 12) : R() * 22;
      const eta = Math.round(promise + offset);
      const transit = Math.round(20 + R() * 60);
      const dispatch = eta - transit;
      const produced = dispatch - Math.round(10 + R() * 30);
      const created = produced - Math.round(30 + R() * 60);
      const gps = R() < 0.72, fastag = R() < 0.88;
      mk({
        id: "VO-" + n++, customer: c.name, seg: c.seg, tier: c.tier, grade: pick(c.grades), t: Math.round(40 + R() * 520), margin: c.margin,
        origin: pick(ORIGINS), dest: c.dest, mode: R() < 0.32 ? "Rail" : "Road", created, confirm: created + +(1.5 + R() * 8).toFixed(1), produced, dispatch, eta, promise,
        lots: 1 + Math.floor(R() * 5), cover: c.seg === 0 ? +(2 + R() * 12).toFixed(1) : 0, penaltyCr: c.tier === "P" ? 3 : 0, sig: { gps, fastag, ewb: R() < 0.95, call: true }
      });
    }
    // a small queue of orders waiting to be confirmed
    for (let i = 0; i < 5; i++) {
      const c = pick(CUSTOMERS), promiseAsk = 100 + Math.round(R() * 90);
      mk({ id: "VO-" + n++, customer: c.name, seg: c.seg, tier: c.tier, grade: pick(c.grades), t: Math.round(60 + R() * 300), margin: c.margin, origin: pick(ORIGINS), dest: c.dest, mode: "Road", created: -Math.round(1 + R() * 6), confirm: null, produced: null, dispatch: null, eta: null, promise: promiseAsk, lots: 1, cover: 0, penaltyCr: 0, sig: { gps: true, fastag: true, ewb: true, call: true } });
    }
    return out;
  }

  const LOTS = [
    { id: "LOT-2201", node: "ncr", grade: "GP coil", kt: 1.5, age: 74, match: "Retail North" },
    { id: "LOT-2207", node: "pune", grade: "CR commercial", kt: 2.2, age: 96, match: "Fabricator Group" },
    { id: "LOT-2214", node: "san", grade: "GP coil", kt: 3.4, age: 88, match: "Retail West" },
    { id: "LOT-2219", node: "bpl", grade: "HR commercial", kt: 4.1, age: 121, match: "SME Cluster" },
    { id: "LOT-2226", node: "che", grade: "HR commercial", kt: 2.8, age: 103, match: "Export Buyer" },
    { id: "LOT-2231", node: "jsr", grade: "HR structural", kt: 3.6, age: 67, match: "EPC Contractor" },
    { id: "LOT-2238", node: "kpo", grade: "HR plate", kt: 2.4, age: 142, match: "EPC Contractor" }
  ];

  // cls: 0 Automated, 1 AI-assisted, 2 Human-led, 3 Leadership
  const DECISIONS = [
    ["Order capture, spec and credit check", 1, 0, "Limits + audit log", 94, 12, 860, 1, 97, 8, true, 6],
    ["Date confirmation inside the envelope", 1, 0, "Caps + 5% sample audit", 91, 12, 1240, 2, 96, 18, true, 9],
    ["ETA and milestone updates to customers", 0, 0, "Send only if ≥80% sure", 97, 26, 5400, 3, 95, 1, true, 2],
    ["Delay early-warning and playbook trigger", 0, 0, "Owner auto-assigned", 96, 24, 3100, 4, 96, 2, true, 3],
    ["Load consolidation", 1, 0, "No promised date moves", 92, 12, 240, 1, 95, 12, true, 7],
    ["Stock rebalancing between SPCs", 1, 1, "Freight vs value shown", 84, 10, 420, 1, 91, 40, true, 14],
    ["CTP date for new production", 1, 1, "Planner approves", 79, 9, 380, -1, 88, 30, true, 18],
    ["Ageing-stock match and offer", 1, 1, "Sales approves price", 86, 12, 310, 2, 93, 22, true, 12],
    ["Constrained allocation (4R rule)", 1, 1, "Owner approves + reason", 82, 16, 330, 3, 96, 180, false, 15],
    ["Shorting a Protected customer", 2, 2, "Named owner, 4-h SLA", 0, 0, 0, 0, 0, 300, false, 0],
    ["Campaign extension, frozen-window break", 2, 2, "Stretch test + plant sign-off", 0, 0, 0, 0, 0, 550, false, 0],
    ["Tiers, ₹ penalties, stock norms", 3, 3, "Quarterly review", 0, 0, 0, 0, 0, 0, false, 0]
  ].map((d, i) => ({ id: i, name: d[0], fy27: d[1], fy29: d[2], guard: d[3], accept: d[4], weeks: d[5], n: d[6], vsHuman: d[7], conf: d[8], stake: d[9], reversible: d[10], overrides: d[11], cur: d[1] }));

  const PILOTS = [
    { id: "UC1", name: "See it early", what: "Delay early-warning + live ETA", scope: "Pipe and tube customers, 1 corridor: 1 plant, 6 SPCs, ~1 MT a year", control: "Matched customers on a non-pilot corridor", week: 16, months: 2,
      gates: [{ l: "ETA right within ±24 h", v: 87, t: 85, u: "%", dir: 1, today: "not tracked" }, { l: "Misses flagged ≥5 days early", v: 72, t: 70, u: "%", dir: 1, today: "~0%" }, { l: "OTIF vs control group", v: 8.6, t: 8, u: " pts", dir: 1, today: "~78%" }, { l: "Fragmented lots vs baseline", v: -21, t: -25, u: "%", dir: -1, today: "baseline" }] },
    { id: "UC2", name: "Decide it right", what: "Value-based allocation (4R)", scope: "Auto cold-rolled: top 15 critical grades, top 10 OEMs, 1 CR complex", control: "Non-pilot grades; 4 weeks shadow mode first", week: 16, months: 2,
      gates: [{ l: "Line stoppages", v: 0, t: 0, u: "", dir: -1, today: "episodic" }, { l: "Hours to allocation call", v: 3.4, t: 4, u: " h", dir: -1, today: "days" }, { l: "AI advice accepted", v: 78, t: 75, u: "%", dir: 1, today: "-" }, { l: "Margin on constrained tonnes", v: 430, t: 400, u: " ₹/t", dir: 1, today: "control" }] }
  ];

  const OTIF_HISTORY = [84.2, 84.9, 85.3, 86.1, 86.4, 87.2, 87.9, 88.3, 89.0, 89.6, 90.2];

  root.VachanData = { SEGMENTS, OWNER, NODES, CUSTOMERS, orders, LOTS, DECISIONS, PILOTS, OTIF_HISTORY, HISTORY: { lines: 1000, onTime: 910 }, DAILY_KT: 20000 / 365, rng };
})(window);
