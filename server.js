import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Resend } from 'resend';

const app = express();

// --- Config / constants ---
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.warn('[boot] RESEND_API_KEY is missing');
}
const resend = new Resend(RESEND_API_KEY);

// sandbox sender is fine during setup
const FROM = 'Portfolio Contact <onboarding@resend.dev>';
const TO = 'kothariananyashree@gmail.com';

// --- CORS (put BEFORE routes) ---
const allowedOrigins = [
  'http://localhost:8888', // Netlify dev (optional)
  'https://playful-buttercream-f2cc50.netlify.app', // your Netlify site
  // add your custom domain here later
];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);
app.options('/contact', cors()); // handle preflight

// --- Common middleware ---
app.use(express.json());

// --- Rate limit only the contact endpoint ---
app.use(
  '/contact',
  rateLimit({
    windowMs: 60_000,
    max: 5,
  })
);

// --- Validation ---
const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email required'),
  subject: z.string().max(150).optional(),
  message: z.string().min(5, 'Message too short'),
  _gotcha: z.string().optional(),
});

// --- Health check ---
app.get('/health', (_, res) => res.json({ ok: true }));

// --- Single contact route ---
app.post('/contact', async (req, res) => {
  try {
    const data = schema.parse(req.body || {});
    // honeypot
    if (data._gotcha) return res.json({ ok: true });

    const { error } = await resend.emails.send({
      from: FROM,
      to: TO,
      reply_to: data.email,
      subject: data.subject || `New message from ${data.name}`,
      text: `From: ${data.name} <${data.email}>\n\n${data.message}`,
    });

    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (e) {
    console.error('SEND ERROR:', e);
    res
      .status(400)
      .json({ ok: false, error: e?.message || 'Something went wrong' });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on ${PORT}`));
