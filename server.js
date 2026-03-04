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
  "amazon","aws","google","digitalocean","hetzner",
  "ovh","azure","microsoft","linode","leaseweb",
  "vultr","m247","datacamp","contabo"
];

// --------------------
// Fingerprint memory + score decay
// --------------------
const fingerprintMap = new Map();
// fingerprint => { ip, score, lastSeen }

// --------------------
function countryTimezoneMismatch(country, timezone) {
  const map = {
    US:"America", CA:"America",
    PL:"Europe", DE:"Europe", FR:"Europe", UK:"Europe", RU:"Europe",
    CN:"Asia", JP:"Asia", IN:"Asia"
  };
  if (!country || !timezone || !map[country]) return false;
  return !timezone.includes(map[country]);
}

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

    const fingerprint = `${ua}|${lang}|${timezone}`;

    const ipinfoRes = await fetch(
      `https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`
    );
    const data = await ipinfoRes.json();

    const org = (data.org || "").toLowerCase();
    const isDataCenterASN = DATACENTER_KEYWORDS.some(k => org.includes(k));

    let score = 0;
    let reasons = [];

    // ---- VPN flags ----
    if (data?.privacy?.vpn)      { score += 3; reasons.push("privacy-vpn"); }
    if (data?.privacy?.proxy)   { score += 3; reasons.push("proxy"); }
    if (data?.privacy?.hosting) { score += 2; reasons.push("hosting"); }
    if (isDataCenterASN)         { score += 2; reasons.push("datacenter-asn"); }

    // ---- BYPASS / IP rotation ----
    const prev = fingerprintMap.get(fingerprint);
    if (prev && prev.ip !== ip) {
      score += 3;
      reasons.push("ip-rotation-bypass");
      if (isDataCenterASN) {
        score += 2;
        reasons.push("dc+rotation");
      }
    }

    // ---- Timezone mismatch ----
    if (countryTimezoneMismatch(data.country, timezone)) {
      score += 2;
      reasons.push("timezone-mismatch");
    }

    // ---- Linux + Hosting ----
    if (/linux/i.test(ua) && (isDataCenterASN || data?.privacy?.hosting)) {
      score += 2;
      reasons.push("linux+hosting");
    }

    // ---- SCORE DECAY ----
    // თუ ადრე ეჭვმიტანილი იყო და ახლა სუფთაა → ვაკლებთ ქულას
    let finalScore = score;
    if (prev) {
      const cleanNow =
        !data?.privacy?.vpn &&
        !data?.privacy?.proxy &&
        !data?.privacy?.hosting &&
        !isDataCenterASN;

      if (cleanNow && prev.score > 0) {
        finalScore = Math.max(prev.score - 2, 0);
        reasons.push("score-decay");
      }
    }

    fingerprintMap.set(fingerprint, {
      ip,
      score: finalScore,
      lastSeen: Date.now()
    });

    const isVPN = finalScore >= 3;

    const suspicion =
      finalScore >= 6 ? "HIGH 🔥" :
      finalScore >= 3 ? "MEDIUM ⚠️" :
      "LOW";

    const message = `
🌐 New Website Visit

IP: ${ip}
Country: ${data.country || "N/A"}
City: ${data.city || "N/A"}
ISP / ASN: ${data.org || "N/A"}

VPN / Proxy: ${isVPN ? "YES 🚨" : "NO ✅"}
Suspicion: ${suspicion}
Score: ${finalScore}
Reasons: ${reasons.join(", ") || "none"}

UA:
${ua}

Language: ${lang}
Timezone: ${timezone}
`;

    await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message })
      }
    );

    res.json({ vpn: isVPN, score: finalScore });

  } catch (e) {
    res.json({ vpn: false, score: 0 });
  }
});

app.listen(3000, () => {
  console.log("Backend running on port 3000");
});
