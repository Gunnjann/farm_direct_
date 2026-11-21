const Product = require('../models/Product');

/**
 * Atomically take `qty` from a product's stock. The filter `stock >= qty`
 * and the $inc happen in ONE database operation, so two buyers can never both
 * take the last 5 kg — one of them gets null back.
 */
async function reserveStock(productId, qty) {
  const res = await Product.findOneAndUpdate(
    { _id: productId, isActive: true, stock: { $gte: qty } },
    { $inc: { stock: -qty } },
    { new: true }
  );
  return res; // null => not enough stock
}

async function releaseStock(productId, qty) {
  if (qty <= 0) return;
  await Product.updateOne({ _id: productId }, { $inc: { stock: qty } });
}

module.exports = { reserveStock, releaseStock };
