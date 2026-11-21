const { expireStaleOrders } = require('../services/orders');
const { closeDueGroups } = require('../services/groups');
const { syncFromDataGov, API_KEY } = require('../services/mandiData');

/**
 * Background housekeeping, every minute:
 *  - release stock held by unpaid checkouts
 *  - close group orders whose deadline passed (confirm or refund)
 *
 * Every step is an atomic conditional update, so running several API
 * instances (each with its own sweeper) is safe.
 */
function startSweeper(intervalMs = 60 * 1000) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const expired = await expireStaleOrders();
      const groups = await closeDueGroups();
      if (expired || groups) console.log(`[sweeper] expired ${expired} unpaid orders, closed ${groups} groups`);
    } catch (e) {
      console.error('[sweeper] failed', e);
    } finally {
      running = false;
    }
  };
  const handle = setInterval(tick, intervalMs);
  handle.unref();
  tick();

  // Mandi prices: sync from AGMARKNET every 6 hours when an API key is configured.
  let priceHandle = null;
  if (API_KEY) {
    const syncPrices = () =>
      syncFromDataGov()
        .then((r) => {
          require('../routes/market').markSynced();
          console.log('[prices] sync', JSON.stringify(r));
        })
        .catch((e) => console.error('[prices] sync failed', e.message));
    syncPrices();
    priceHandle = setInterval(syncPrices, 6 * 3600 * 1000);
    priceHandle.unref();
  }
  return () => {
    clearInterval(handle);
    if (priceHandle) clearInterval(priceHandle);
  };
}

module.exports = { startSweeper };
