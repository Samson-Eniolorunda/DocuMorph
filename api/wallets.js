/* =========================================================
   /api/wallets.js  (Vercel Serverless Function)
   ---------------------------------------------------------
   Purpose:
   - Returns crypto wallet addresses to the frontend securely.
   - Wallets are stored as environment variables (not hard-coded)
     so your public repo never exposes addresses directly.

   Response:
   - JSON object containing:
     - Standard coins: btc, eth, bnb, sol, ton, tron
     - USDT networks: usdt_eth, usdt_bnb, usdt_trc, usdt_sol, usdt_ton, usdt_arb

   Requirements:
   - Configure these env vars in Vercel Project Settings:
     WALLET_BTC, WALLET_ETH, WALLET_BNB, WALLET_SOL, WALLET_TON, WALLET_TRON
     WALLET_USDT_ETH, WALLET_USDT_BSC, WALLET_USDT_TRX, WALLET_USDT_SOL,
     WALLET_USDT_TON, WALLET_USDT_ARB

   Notes:
   - If an env var is missing, the API returns "Address Not Set".
   ========================================================= */

export default function handler(req, res) {
  res.status(200).json({
    // -----------------------------
    // Standard Coins
    // -----------------------------
    btc: process.env.WALLET_BTC || "Address Not Set",
    eth: process.env.WALLET_ETH || "Address Not Set",
    bnb: process.env.WALLET_BNB || "Address Not Set",
    sol: process.env.WALLET_SOL || "Address Not Set",
    ton: process.env.WALLET_TON || "Address Not Set",
    tron: process.env.WALLET_TRON || "Address Not Set",

    // -----------------------------
    // USDT Networks
    // -----------------------------
    usdt_eth: process.env.WALLET_USDT_ETH || "Address Not Set",
    usdt_bnb: process.env.WALLET_USDT_BSC || "Address Not Set",
    usdt_trc: process.env.WALLET_USDT_TRX || "Address Not Set",
    usdt_sol: process.env.WALLET_USDT_SOL || "Address Not Set",
    usdt_ton: process.env.WALLET_USDT_TON || "Address Not Set",
    usdt_arb: process.env.WALLET_USDT_ARB || "Address Not Set",
  });
}
