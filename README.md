# VACHAN Fulfilment Control Tower

A working prototype of an order-to-delivery control tower for steel sales planning, built for the Steel-a-thon XIII Sales Planning case, "Every Tonne, On Time, At Value".

**Student prototype. All orders and customers are simulated, and rupee values use the case's illustrative economics. It is not a Tata Steel product or system, and it connects to no real data.**

## What works

| Screen | What you can do |
| --- | --- |
| Overview | Live KPIs, network risk map, predicted exceptions and OTIF trend, all driven by your actions |
| Orders | Search and filter order lines, see each order's late risk and its journey, confirm a date for waiting orders |
| Exceptions | Accept a recommended playbook or override it with a reason code. Clocks escalate L1 to L3 as time moves |
| Allocation | Edit the Exhibit 8 inputs and run the 4R rule and the stretch test. Approve or override the result |
| Network | Lanes, stock by location, shipments, and matching high-age lots to open demand. Switch off GPS on a truck to see the fallback ladder |
| Decision rights | 12 decisions with five graduation tests. A decision can move to Automated only when all five pass |
| Pilot gates | Change pilot results and see the go / no-go call |
| Value tracker | Move any assumption and see EBITDA, cash, NPV, payback and sensitivity |
| Customer view | The order status a customer would see |
| Audit trail | Every decision with who, when and why, downloadable as CSV |

Use **+1 hour** and **+6 hours** to move simulated time forward. Use **Viewing as** to switch role. **Reset demo** restores the starting state.

## A two-minute demo

1. On **Overview**, note Orders at risk and Value at risk.
2. Go to **Exceptions** and press **Accept** on the OEM A line. Return to Overview and see the numbers move.
3. On **Allocation**, see the Exhibit 8 answer of Rs 18.07 Cr, then press **OEM A needs 10.5 KT** to see the campaign extension win.
4. On **Value tracker**, press **Low case**, then drag **Days of stock removed**.
5. Open **Audit trail** to see what you just decided.

## How it is built

Plain HTML, CSS and JavaScript with no build step and no dependencies. It runs entirely in the browser, and your session is kept in that browser's local storage.

- `js/model.js`: the 4R allocation rule, stretch test, value model and graduation tests, as pure functions
- `js/data.js`: the simulated orders, stock and decisions
- `js/app.js`: screens and actions
- `test/model.test.js`: checks the engine against the case numbers (`node test/model.test.js`)

The late-risk score is a simple illustrative formula based on slack and location confidence. It is not a trained model.

## Credits

India map outlines from [@svg-maps/india](https://github.com/VictorCazanave/svg-maps), CC BY 4.0.
