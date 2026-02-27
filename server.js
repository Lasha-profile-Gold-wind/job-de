// --------------------
// საჭირო ბიბლიოთეკები
// --------------------
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

// --------------------
// აპის ინიციალიზაცია
// --------------------
const app = express();
app.use(cors());
app.use(express.json());

// --------------------
// 🔴 შენი კონფიგურაცია
// --------------------
const TELEGRAM_BOT_TOKEN = "8564801194:AAGZggRCK6K7TLGx7_PrDXvvHkTzgZnuQ1Q";
const TELEGRAM_CHAT_ID = "8245277854";
const IPINFO_TOKEN = "d7652d88eb1406";

// --------------------
// DataCenter ASN keywords
// --------------------
const DATACENTER_KEYWORDS = [
  "amazon", "aws", "google", "digitalocean", "hetzner",
  "ovh", "azure", "microsoft", "linode", "leaseweb",
  "vultr", "m247"
];

// --------------------
// Fingerprint memory (in-memory)
// ⚠️ Render restart-ზე სუფთავდება (ნორმალურია)
// --------------------
const fingerprintMap = new Map();

// --------------------
// მთავარი endpoint
// --------------------
app.get("/track", async (req, res) => {
  try {
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

    const ua = req.headers["user-agent"] || "unknown";
    const lang = req.headers["accept-language"] || "unknown";
    const timezone = req.headers["x-timezone"] || "unknown";

    // Fingerprint (უბრალო, მაგრამ ეფექტური)
    const fingerprint = `${ua}|${lang}|${timezone}`;

    // IPINFO
    const ipinfoRes = await fetch(
      `https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`
    );
    const data = await ipinfoRes.json();

    const org = (data.org || "").toLowerCase();

    const isDataCenterASN = DATACENTER_KEYWORDS.some(k =>
      org.includes(k)
    );

    // --------------------
    // VPN score სისტემა
    // --------------------
    let score = 0;
    let reasons = [];

    if (data?.privacy?.vpn)      { score += 3; reasons.push("privacy-vpn"); }
    if (data?.privacy?.proxy)   { score += 3; reasons.push("proxy"); }
    if (data?.privacy?.hosting) { score += 2; reasons.push("hosting"); }
    if (isDataCenterASN)         { score += 2; reasons.push("datacenter-asn"); }

    // --------------------
    // VPN BYPASS detection
    // --------------------
    if (fingerprintMap.has(fingerprint)) {
      const oldIP = fingerprintMap.get(fingerprint);
      if (oldIP !== ip) {
        score += 3;
        reasons.push("ip-rotation-bypass");
      }
    }

    fingerprintMap.set(fingerprint, ip);

    // Country vs timezone mismatch
    if (data.country === "US" && !timezone.includes("America")) {
      score += 1;
      reasons.push("timezone-mismatch");
    }

    const isVPN = score >= 4;

    // --------------------
    // Telegram შეტყობინება
    // --------------------
    const message = `
🌐 New Website Visit

IP: ${ip}
Country: ${data.country || "N/A"}
City: ${data.city || "N/A"}
ISP / ASN: ${data.org || "N/A"}

VPN / Proxy: ${isVPN ? "YES 🚨" : "NO ✅"}
Score: ${score}
Reasons: ${reasons.join(", ")}

User-Agent:
${ua}

Language: ${lang}
Timezone: ${timezone}
    `;

    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message
        })
      }
    );

    res.json({ vpn: isVPN });

  } catch (err) {
    res.json({ vpn: false });
  }
});

// --------------------
app.listen(3000, () => {
  console.log("Backend running on port 3000");
});
