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
app.use(cors());            // GitHub Pages-დან წვდომისთვის
app.use(express.json());

// --------------------
// 🔴 შენი კონფიგურაცია
// --------------------
const TELEGRAM_BOT_TOKEN = "8564801194:AAGZggRCK6K7TLGx7_PrDXvvHkTzgZnuQ1Q";
const TELEGRAM_CHAT_ID = "8245277854";
const IPINFO_TOKEN = "d7652d88eb1406";

// --------------------
// ცნობილი Data Center / VPN ASN სიტყვები
// --------------------
const DATACENTER_KEYWORDS = [
  "amazon", "aws", "google", "digitalocean", "hetzner",
  "ovh", "azure", "microsoft", "linode", "leaseweb",
  "vultr", "m247"
];

// --------------------
// მთავარი endpoint
// --------------------
app.get("/track", async (req, res) => {
  try {
    // IP ამოღება
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

    // ბრაუზერის მონაცემები
    const ua = req.headers["user-agent"] || "Unknown";
    const lang = req.headers["accept-language"] || "Unknown";
    const ref = req.headers["referer"] || "Direct";

    // IPINFO API
    const ipinfoRes = await fetch(
      `https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`
    );
    const data = await ipinfoRes.json();

    // ASN / ISP ტექსტი
    const org = (data.org || "").toLowerCase();

    // ASN-ის შემოწმება (Data Center თუა)
    const isDataCenterASN = DATACENTER_KEYWORDS.some(k =>
      org.includes(k)
    );

    // VPN / Proxy საბოლოო შეფასება
    const isVPN =
      data?.privacy?.vpn ||
      data?.privacy?.proxy ||
      data?.privacy?.hosting ||
      data?.privacy?.relay ||
      isDataCenterASN;

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
ASN Datacenter: ${isDataCenterASN ? "YES" : "NO"}

User-Agent:
${ua}
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

    // Frontend-ს ვუბრუნებთ მხოლოდ vpn=true/false
    res.json({ vpn: isVPN });

  } catch (err) {
    // შეცდომის შემთხვევაშიც საიტი არ უნდა ჩამოიშალოს
    res.json({ vpn: false });
  }
});

// --------------------
// სერვერის გაშვება
// --------------------
app.listen(3000, () => {
  console.log("Backend running on port 3000");

});
