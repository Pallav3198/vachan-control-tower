// Run with: node test/model.test.js
// Checks the engine against the numbers in the case and the submission deck.
const assert = require("assert");
const M = require("../js/model.js");
const near = (a, b, d, m) => assert.ok(Math.abs(a - b) <= d, `${m}: got ${a}, expected ${b}`);
const clone = o => JSON.parse(JSON.stringify(o));
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("value case matches the deck", () => {
  const b = M.cashflow(M.BASE), L = b.levers;
  near(L.recurring, 310.4, 0.1, "EBITDA"); near(L.totalPL, 470.1, 0.1, "P&L"); near(L.oneTime, 1459.4, 0.1, "cash");
  near(L.logistics, 75, 0.01, "logistics"); near(L.allocation, 96, 0.01, "allocation"); near(L.mix, 98, 0.01, "mix"); near(L.highAge, 23.4, 0.01, "age"); near(L.productivity, 18, 0.01, "productivity");
  near(b.npv, 1745, 0.5, "NPV"); near(b.recurringNpv, 571, 0.5, "recurring NPV");
  [-28.5, 629.4, 1121, 280.4, 280.4].forEach((f, i) => near(b.flows[i], f, 0.1, "flow " + i));
  assert.strictEqual(b.payback, "~18 months");
});
t("low and high cases match", () => { near(M.cashflow(M.LOW).npv, 835, 0.5, "low"); near(M.cashflow(M.HIGH).npv, 3053, 0.5, "high"); });
t("sensitivity matches the deck", () => {
  const T = Object.fromEntries(M.tornado(M.BASE).map(r => [r[0], r]));
  near(T["Stock days cut"][1], -467, 1, "stock"); near(T["Allocation uplift"][2], 466, 1, "alloc"); near(T["6-month adoption delay"][1], -184, 1, "delay"); near(T["Cost overrun of 50%"][1], -106, 1, "cost");
});
t("Exhibit 8: every option matches", () => {
  const s = M.solve(M.EXHIBIT8), v = Object.fromEntries(s.options.map(o => [o.name, o.value]));
  near(v["Pro-rata share"], 12.08, 0.01, "pro-rata"); near(v["Extend campaign"], 14.1, 0.01, "extend"); near(v["Rank by margin only"], 16.9, 0.01, "margin"); near(v["4R rule"], 18.07, 0.01, "4R");
  assert.strictEqual(s.extend, false);
  near(s.stretch.cost, 5.5, 1e-9, "cost"); near(s.stretch.gain, 1.35, 1e-9, "gain"); near(s.stretch.net, -4.15, 1e-9, "net"); near(s.stretch.hurdle, 13750, 1e-6, "hurdle");
  assert.strictEqual(s.approver, "Promise Owner");
});
t("Exhibit 8: who gets what", () => {
  const r = Object.fromEntries(M.solve(M.EXHIBIT8).rule.rows.map(x => [x.c.name, x]));
  assert.deepStrictEqual([r["OEM A"].gets, r["OEM B"].gets, r.Retail.gets, r.Export.gets], [5, 3, 2, 1.5]);
  assert.deepStrictEqual([r["OEM A"].rule, r["OEM B"].rule, r.Retail.rule, r.Export.rule], ["Protect", "Re-time", "Re-source", "Rank"]);
  near(r["OEM A"].end, 7, 1e-9, "A ends day 7"); near(r["OEM B"].end, 11.2, 1e-9, "B ends day 11.2"); near(r.Export.end, 14, 1e-9, "campaign ends day 14");
  assert.ok(r["OEM A"].bridge, "OEM A needs a bridge");
});
t("stress tests", () => {
  const a = clone(M.EXHIBIT8); a.displaced = 0; assert.strictEqual(M.solve(a).extend, false, "displaced 0");
  const b = clone(M.EXHIBIT8); b.network.kt = 0; const bs = M.solve(b); near(bs.stretch.gain, 2.7, 1e-9, "no SPC gain"); assert.strictEqual(bs.extend, false);
  const c = clone(M.EXHIBIT8); c.customers[0].need = 10.5; assert.strictEqual(M.solve(c).extend, true, "Protected demand above the campaign flips");
  const d = clone(M.EXHIBIT8); d.customers[0].need = 6.5; assert.strictEqual(M.solve(d).extend, false, "6.5 KT still fits inside the campaign");
});
t("graduation tests", () => {
  const good = { accept: 93, weeks: 12, n: 410, vsHuman: 1, conf: 96, stake: 10, reversible: true };
  assert.ok(M.graduationTests(good).every(x => x.ok));
  assert.ok(!M.graduationTests(Object.assign({}, good, { n: 299 })).every(x => x.ok));
});
t("late probability falls with slack", () => { assert.ok(M.lateProbability(0, 0.95) > M.lateProbability(48, 0.95)); });
console.log(`\n${n} test groups passed`);
