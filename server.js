import 'dotenv/config';
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Resend } from "resend";

// --- sanity log (safe) ---
const hasKey = !!process.env.RESEND_API_KEY;
const keyLen = (process.env.RESEND_API_KEY || '').length;
const keyPrefix = (process.env.RESEND_API_KEY || '').slice(0, 3);
console.log(`[boot] RESEND_API_KEY present=${hasKey} len=${keyLen} prefix=${keyPrefix}`);


const app = express();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = "kothariananyashree@gmail.com";
const FROM_EMAIL = "Portfolio Contact <contact@yourdomain.com>"; // set this up in Resend

// Allow your Netlify site + local dev
const allowedOrigins = [
  "http://localhost:8888",                      // Netlify dev server (optional)
  "https://playful-buttercream-f2cc50.netlify.app",
  "https://<your-custom-domain>"                // add later if you attach a domain
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  }
}));

app.use(express.json());
app.use("/contact", rateLimit({ windowMs: 60_000, max: 5 }));

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email required"),
  subject: z.string().max(150).optional(),
  message: z.string().min(5, "Message too short"),
  _gotcha: z.string().optional()
});

app.get("/health", (_, res) => res.json({ ok: true }));

app.post("/contact", async (req, res) => {
  try {
    const data = schema.parse(req.body || {});
    if (data._gotcha) return res.json({ ok: true });

    const resend = new Resend(RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      reply_to: data.email,
      subject: data.subject || `New message from ${data.name}`,
      text: `From: ${data.name} <${data.email}>\n\n${data.message}`
    });

    if (error) throw error;
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || "Bad request" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on ${PORT}`));
