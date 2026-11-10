# VACHAN Control Tower

A playable prototype of an order-to-delivery control tower for steel, built for the Steel-a-thon XIII Sales Planning case, "Every Tonne, On Time, At Value".

**Student prototype. Every order and customer is made up, and rupee values use the case's illustrative numbers. It is not a Tata Steel product or system, and it connects to no real data.**

## Try it

Open the site and start the first mission. Time runs by itself, trucks move on the map, and problems appear as you watch.

| Section | What it does |
| --- | --- |
| Today | Promise meter, live map, live feed, and three short missions |
| Needs you | One decision at a time. Small problems are handled automatically |
| Where's my steel | Tap a truck to see its journey, then switch off its GPS |
| Split the steel | Watch the allocation rule step by step, and try "what if" |
| Is it worth it? | Drag the assumptions and see profit, cash and NPV change |
| Behind the scenes | All orders, who decides what, pilot results, the customer's phone, and the decision log |

## How it is built

Plain HTML, CSS and JavaScript with no build step. It runs entirely in the browser and remembers your session in that browser.

- `js/model.js`: the allocation rule, stretch test, value model and graduation tests, as pure functions
- `js/data.js`: the simulated orders, stock and decisions
- `js/app.js`: live loop, screens and missions
- `test/model.test.js`: checks the engine against the case numbers (`node test/model.test.js`)

The late-risk score is a simple illustrative formula based on slack and location confidence. It is not a trained model.

## Credits

India map outlines from [@svg-maps/india](https://github.com/VictorCazanave/svg-maps), CC BY 4.0. Font: Nunito (SIL Open Font License).
