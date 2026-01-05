/**
 * /api/wallets  (Vercel Serverless Function)
 * ---------------------------------------------------------
 * Purpose:
 * - Returns donation wallet addresses to the frontend.
 * - Keeps addresses configurable via Vercel ENV.
 *
 * Env (set what you have):
 *   WALLET_BTC, WALLET_ETH, WALLET_BNB, WALLET_SOL, WALLET_TON, WALLET_TRON
 *   WALLET_USDT_ETH, WALLET_USDT_BNB, WALLET_USDT_TRC, WALLET_USDT_SOL, WALLET_USDT_TON, WALLET_USDT_ARB
 */
module.exports = (req, res) => {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    return res.end("Method Not Allowed");
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  const out = {
    btc: process.env.WALLET_BTC || "Address Not Set",
    eth: process.env.WALLET_ETH || "Address Not Set",
    bnb: process.env.WALLET_BNB || "Address Not Set",
    sol: process.env.WALLET_SOL || "Address Not Set",
    ton: process.env.WALLET_TON || "Address Not Set",
    tron: process.env.WALLET_TRON || "Address Not Set",

    usdt_eth: process.env.WALLET_USDT_ETH || "Address Not Set",
    usdt_bnb: process.env.WALLET_USDT_BNB || "Address Not Set",
    usdt_trc: process.env.WALLET_USDT_TRC || "Address Not Set",
    usdt_sol: process.env.WALLET_USDT_SOL || "Address Not Set",
    usdt_ton: process.env.WALLET_USDT_TON || "Address Not Set",
    usdt_arb: process.env.WALLET_USDT_ARB || "Address Not Set",
  };

  res.end(JSON.stringify(out));
};
