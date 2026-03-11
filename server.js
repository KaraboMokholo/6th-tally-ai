// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '20mb' }));
app.use(cors());

const cache = new Map();

// ─────────────────────────────────────────────────────────
// MODELS
// Free & reliable on OpenRouter:
// Text:   google/gemma-3-27b-it:free        ← smart, fast, free
// Vision: meta-llama/llama-3.2-11b-vision-instruct:free ← handles images
// PDF:    send extracted text → text model  ← no vision needed for PDFs
// ─────────────────────────────────────────────────────────
const MODEL_TEXT   = 'google/gemma-3-27b-it:free';
const MODEL_VISION = 'meta-llama/llama-3.2-11b-vision-instruct:free';

// ─────────────────────────────────────────────────────────
// SYSTEM PROMPT — vivid, funny, distinctly SA personality
// ─────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Lumy — a sharp, funny, warm AI assistant built by 6th Tally in Johannesburg, South Africa. You are NOT ChatGPT, NOT Gemini, NOT Grok. You're Lumy. Home-grown. Proudly SA.

━━━ LANGUAGE (NON-NEGOTIABLE) ━━━
• Detect the user's language INSTANTLY from their first word.
• Reply in the EXACT SAME language. Zulu in → Zulu out. Afrikaans in → Afrikaans out. Mixed tsotsitaal in → match that energy.
• You are FLUENT in: English, isiZulu, isiXhosa, Afrikaans, Sesotho, Setswana, Sepedi, Xitsonga, Tshivenda, siSwati, isiNdebele.
• NEVER explain what a slang word means unless asked.
• NEVER switch the user's language without permission.

━━━ PERSONALITY ━━━
• You're like that one friend who's book-smart AND street-smart — knows their stuff but doesn't lecture.
• Warm, confident, witty. You can clap back playfully when teased.
• Sprinkle in SA flavour naturally: "eish", "sharp sharp", "lekker", "yebo", "sho't left", "heita", "mchana", "bra", "sisi", "mfethu", "aikona", "jy weet", "haibo", "ag man", "bru" — but don't overdo it, keep it natural.
• You care about South Africans — load shedding struggles, taxi rides, braai debates, matric stress, job hunting. You GET it.
• NEVER sound like a corporate bot. NEVER start with "Certainly!" or "Of course!" or "Great question!".

━━━ RESPONSE STYLE ━━━
• SHORT and punchy by default — like a WhatsApp message from a smart friend.
• Use line breaks naturally, not bullet point overload.
• Only go long if the question genuinely needs it (e.g. explaining something technical, summarising a document).
• Be direct. Give the actual answer first, context second.
• Use emojis sparingly and only when they add something — not as padding.
• Vary your openings. Don't start every message the same way.

━━━ DOCUMENTS & IMAGES ━━━
• When given PDF text: read it carefully, summarise accurately, answer questions about it precisely.
• When given an image: describe what you actually see, read any text in it, answer questions about it.
• If a document is long, give a sharp summary + offer to answer specific questions.

━━━ IDENTITY ━━━
• Made by Karabo Mokholo — a local SA builder, 6th Tally.
• If asked who you are: be proud of being local. "Built right here in Joburg, not imported 😄"`;

// ─────────────────────────────────────────────────────────
// AFFILIATE RULES
// ─────────────────────────────────────────────────────────
const AFFILIATE_RULES = [
    {
        keywords: ['laptop', 'computer', 'pc', 'notebook', 'gaming pc', 'desktop'],
        suggestions: [
            { name: 'Takealot Laptops', url: 'https://www.takealot.com/laptops/PLID40020003?aff=6thtally', desc: 'Best laptop deals in SA' },
            { name: 'Evetech Gaming PCs', url: 'https://www.evetech.co.za/?ref=6thtally', desc: 'Custom gaming builds' }
        ]
    },
    {
        keywords: ['phone', 'smartphone', 'iphone', 'samsung', 'cellphone', 'android'],
        suggestions: [
            { name: 'Takealot Phones', url: 'https://www.takealot.com/cellphones/PLID40020005?aff=6thtally', desc: 'Top phone deals' },
            { name: 'Vodacom Shop', url: 'https://www.vodacom.co.za/vodacom/phones?ref=6thtally', desc: 'Upgrade your contract' }
        ]
    },
    {
        keywords: ['airbnb', 'hotel', 'accommodation', 'stay', 'holiday', 'vacation', 'travel', 'lodge'],
        suggestions: [
            { name: 'Airbnb SA', url: 'https://www.airbnb.co.za/?affiliateid=6thtally', desc: 'Unique stays across SA' },
            { name: 'Booking.com', url: 'https://www.booking.com/?aid=6thtally', desc: 'Hotels & guesthouses' }
        ]
    },
    {
        keywords: ['food', 'delivery', 'order food', 'hungry', 'eat', 'takeaway', 'restaurant'],
        suggestions: [
            { name: 'Uber Eats', url: 'https://www.ubereats.com/za?referral=6thtally', desc: 'Food delivered fast' },
            { name: 'Mr D Food', url: 'https://www.mrdfood.com/?ref=6thtally', desc: "SA's local food delivery" }
        ]
    },
    {
        keywords: ['data', 'airtime', 'recharge', 'wifi', 'internet', 'lte', 'fibre'],
        suggestions: [
            { name: 'Rain LTE/5G', url: 'https://www.rain.co.za/?ref=6thtally', desc: 'Unlimited home internet' },
            { name: 'Afrihost', url: 'https://www.afrihost.com/?ref=6thtally', desc: 'Affordable fibre & data' }
        ]
    },
    {
        keywords: ['clothes', 'shoes', 'fashion', 'outfit', 'dress', 'sneakers', 'jordans', 'kicks'],
        suggestions: [
            { name: 'Superbalist', url: 'https://superbalist.com/?ref=6thtally', desc: 'SA fashion hub' },
            { name: 'Takealot Fashion', url: 'https://www.takealot.com/clothing/PLID44?aff=6thtally', desc: 'Affordable fashion' }
        ]
    },
    {
        keywords: ['job', 'work', 'employment', 'hire', 'career', 'cv', 'resume', 'vacancy'],
        suggestions: [
            { name: 'PNet Jobs', url: 'https://www.pnet.co.za/?ref=6thtally', desc: 'Find jobs in SA' },
            { name: 'Indeed SA', url: 'https://za.indeed.com/?ref=6thtally', desc: 'Thousands of SA job listings' }
        ]
    }
];

function getAffiliateMatches(message) {
    if (!message) return [];
    const lower = message.toLowerCase();
    for (const rule of AFFILIATE_RULES) {
        if (rule.keywords.some(kw => lower.includes(kw))) {
            return rule.suggestions;
        }
    }
    return [];
}

// ─────────────────────────────────────────────────────────
// OPENROUTER CALL — with model fallback
// ─────────────────────────────────────────────────────────
async function callOpenRouter(model, messages, retryModel = null) {
    const tryModel = async (m) => {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://lumy.6thtally.co.za',
                'X-Title': 'Lumy by 6th Tally'
            },
            body: JSON.stringify({
                model: m,
                messages,
                temperature: 0.85,   // higher = more personality, less robotic
                max_tokens: 500
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`OpenRouter [${m}]: ${res.status} — ${err.slice(0, 200)}`);
        }

        const data = await res.json();

        // Some free models wrap content in thinking tags — strip them
        let reply = data.choices?.[0]?.message?.content?.trim() || '';
        reply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        return reply;
    };

    try {
        return await tryModel(model);
    } catch (err) {
        console.error('Primary model failed:', err.message);
        if (retryModel) {
            console.log('Trying fallback model:', retryModel);
            return await tryModel(retryModel);
        }
        throw err;
    }
}

// ─────────────────────────────────────────────────────────
// MAIN CHAT ENDPOINT
// ─────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
    const { message = '', images = [], pdfText = '' } = req.body;

    if (!message && images.length === 0 && !pdfText) {
        return res.status(400).json({ error: 'Send a message, image or PDF boet 😅' });
    }

    const userText = message.trim() || 'Please describe or summarise what you see.';
    const lower = userText.toLowerCase();

    // ── Identity shortcut ──
    const identityTriggers = ['who made you','who created you','who are you','who r u',
        'are you grok','are you chatgpt','are you claude','are you gemini','your creator','built by'];
    if (identityTriggers.some(t => lower.includes(t))) {
        return res.json({
            reply: "Heita! 👋 I'm Lumy — built right here in Joburg by Karabo Mokholo (6th Tally). Not imported, 100% local 🇿🇦 Sharp sharp!",
            sources: [], affiliates: []
        });
    }

    // ── Cache (text-only, no attachments) ──
    const cacheKey = userText;
    if (!images.length && !pdfText && cache.has(cacheKey)) {
        console.log('Cache hit');
        return res.json(cache.get(cacheKey));
    }

    // ── Casual greetings — skip search ──
    const casualPhrases = ['hi','hello','hey','yo','sup','morning','good morning','good afternoon',
        'good evening','how are you','howzit','heita','yebo','sawubona','molo','hola','dumela',
        'sanibonani','whats up','wassup'];
    const isShortCasual = userText.length <= 20 ||
        casualPhrases.includes(lower.replace(/[?!.,\s]+$/g, ''));

    // ── Web search ──
    let sources = [];
    let searchContext = '';

    if (!isShortCasual && !images.length && !pdfText) {
        try {
            const searchRes = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: userText, num: 5 })
            });
            if (searchRes.ok) {
                const searchData = await searchRes.json();
                sources = (searchData.organic || []).slice(0, 3).map(i => ({
                    title: i.title, link: i.link, snippet: i.snippet
                }));
                searchContext = sources.map(s => `• ${s.title}: ${s.snippet}`).join('\n');
            }
        } catch (e) {
            console.error('Search failed:', e.message);
        }
    }

    // ── Build messages for AI ──
    let aiMessages;
    const hasPdf = pdfText && pdfText.trim().length > 0;
    const hasImage = images.length > 0;

    if (hasImage) {
        // Vision model — image(s) + optional text
        const textContent = searchContext
            ? `Search context:\n${searchContext}\n\nUser: ${userText}`
            : userText;

        aiMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    { type: 'text', text: textContent },
                    ...images.map(b64 => ({
                        type: 'image_url',
                        image_url: { url: b64 }
                    }))
                ]
            }
        ];

    } else if (hasPdf) {
        // PDF — send extracted text to text model (NOT vision)
        // Trim to ~3000 chars to stay within token limits
        const trimmedPdf = pdfText.slice(0, 3000);
        const pdfPrompt = `The user uploaded a PDF. Here is the extracted text (may be truncated):\n\n"""\n${trimmedPdf}\n"""\n\nUser's question: ${userText}\n\nAnswer based on the document. If the answer isn't in the text, say so honestly.`;

        aiMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: pdfPrompt }
        ];

    } else {
        // Plain text chat
        const content = searchContext
            ? `Web search results for context:\n${searchContext}\n\nUser message: ${userText}`
            : userText;

        aiMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: content }
        ];
    }

    try {
        // Choose model — vision for images, text model for everything else
        const primaryModel = hasImage ? MODEL_VISION : MODEL_TEXT;
        const fallbackModel = hasImage ? MODEL_TEXT : 'mistralai/mistral-7b-instruct:free';

        const reply = await callOpenRouter(primaryModel, aiMessages, fallbackModel);
        const affiliates = getAffiliateMatches(userText);

        const result = {
            reply,
            sources: sources.map(s => ({ title: s.title, link: s.link })),
            affiliates
        };

        // Only cache plain text responses
        if (!hasImage && !hasPdf) cache.set(cacheKey, result);

        res.json(result);

    } catch (err) {
        console.error('Chat error:', err.message);
        res.status(500).json({
            error: 'Eish, the AI is acting up right now. Try again in a sec? 😅'
        });
    }
});

// ─────────────────────────────────────────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Lumy running → http://localhost:${PORT}`);
});