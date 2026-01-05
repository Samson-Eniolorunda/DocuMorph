/* =========================================================
   /api/form.js  (Vercel Serverless Function)
   ---------------------------------------------------------
   Purpose:
   - Secure proxy for Formspree submissions.
   - Keeps your Formspree form ID hidden in environment variables.
   - Receives JSON from the frontend and forwards it to Formspree.

   How it works:
   1) Frontend sends POST /api/form with JSON body:
      { type, email, message, ... }
   2) This API reads FORMSPREE_ID from env
   3) Sends POST request to https://formspree.io/f/<FORMSPREE_ID>
   4) Returns success/failure to the frontend

   Requirements:
   - Set environment variable in Vercel:
     FORMSPREE_ID

   Notes:
   - This version expects req.body to already be parsed (JSON).
   - Ensure your frontend sets Content-Type: application/json
   ========================================================= */

const https = require("https");

export default async function handler(req, res) {
  // -----------------------------
  // Only allow POST requests
  // -----------------------------
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // -----------------------------
  // Load Formspree ID from env
  // -----------------------------
  const formId = process.env.FORMSPREE_ID;
  if (!formId) {
    return res.status(500).json({ error: "Form ID missing" });
  }

  // -----------------------------
  // Create request to Formspree endpoint
  // -----------------------------
  const externalReq = https.request(
    `https://formspree.io/f/${formId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    },
    (externalRes) => {
      // We keep response minimal to avoid leaking upstream details
      res.status(externalRes.statusCode).json({ success: true });
    }
  );

  // -----------------------------
  // Handle upstream errors
  // -----------------------------
  externalReq.on("error", () => {
    res.status(500).json({ error: "Formspree Error" });
  });

  // -----------------------------
  // Forward body (JSON) to Formspree
  // -----------------------------
  externalReq.write(JSON.stringify(req.body));
  externalReq.end();
}
