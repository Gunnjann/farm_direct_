/**
 * All money is stored and computed as integer PAISE (1 INR = 100 paise).
 * Floating-point rupees cause rounding drift (0.1 + 0.2 !== 0.3), which is
 * unacceptable for payments. Razorpay also expects amounts in paise.
 */
const toPaise = (rupees) => Math.round(Number(rupees) * 100);
const toRupees = (paise) => Math.round(paise) / 100;
const percentOf = (paise, percent) => Math.round((paise * percent) / 100);

module.exports = { toPaise, toRupees, percentOf };
