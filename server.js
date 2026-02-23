import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.set("trust proxy", true);
app.use(cors());
app.use(express.json());

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const IPINFO_TOKEN = process.env.IPINFO_TOKEN;

app.get("/", (req, res) => {
    res.send("Backend is running");
});

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
            data?.privacy?.hosting ||
            false;

        const text = `🌐 New Site Visit

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
        console.error(e);
        res.json({ vpn: false });
    }
});

app.listen(3000, () => {
    console.log("Backend running on port 3000");
});