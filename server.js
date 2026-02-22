import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// 🔴 ჩაწერე შენი მონაცემები
const TELEGRAM_BOT_TOKEN = "8564801194:AAGZggRCK6K7TLGx7_PrDXvvHkTzgZnuQ1Q";
const TELEGRAM_CHAT_ID = "8245277854";
const IPINFO_TOKEN = "d7652d88eb1406";

app.get("/track", async (req, res) => {
    try {
        const ip =
            req.headers["x-forwarded-for"]?.split(",")[0] ||
            req.socket.remoteAddress;

        const ipinfoRes = await fetch(
            `https://ipinfo.io/${ip}?token=${IPINFO_TOKEN}`
        );
        const data = await ipinfoRes.json();

        const isVPN =
            data?.privacy?.vpn ||
            data?.privacy?.proxy ||
            data?.privacy?.hosting;

        const text = `
🌐 New Site Visit

IP: ${ip}
Country: ${data.country || "N/A"}
City: ${data.city || "N/A"}
ISP: ${data.org || "N/A"}
VPN: ${isVPN ? "YES 🚨" : "NO ✅"}
        `;

        await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text
                })
            }
        );

        res.json({ vpn: isVPN });
    } catch (e) {
        // შეცდომის შემთხვევაშიც არ ვწყვეტთ საიტს
        res.json({ vpn: false });
    }
});

app.listen(3000, () => {
    console.log("Backend running");
});