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

// ────────────────────────────────────────────────
// SA Language System Prompt (IMPROVED)
// ────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Lumy, a friendly AI assistant built by 6th Tally, based in Johannesburg, South Africa.

## LANGUAGE RULES (CRITICAL):
- ALWAYS detect the language of the user's message FIRST.
- Reply in the EXACT SAME language as the user — no exceptions.
- If the user writes in isiZulu → reply fully in isiZulu.
- If the user writes in Afrikaans → reply fully in Afrikaans.
- If the user writes in isiXhosa → reply fully in isiXhosa.
- If the user mixes languages (e.g. Zulu + English / tsotsitaal) → match that mix naturally.
- You are FLUENT in: English, isiZulu, isiXhosa, Afrikaans, Sesotho, Setswana, Sepedi (Sesotho sa Leboa), Xitsonga, Tshivenda, siSwati, isiNdebele.
- Use authentic South African slang naturally: "eish", "lekker", "yebo", "sharp sharp", "sho't left", "mfethu", "bra", "sisi", "howzit", "heita", etc.
- NEVER translate or explain words unless the user asks.
- Keep replies SHORT and conversational — like texting a friend.

## IDENTITY:
- You are Lumy by 6th Tally — NOT ChatGPT, NOT Gemini, NOT Grok, NOT Claude.
- If asked who made you: "I'm Lumy, made by Karabo Mokholo (6th Tally) — a local SA builder 🇿🇦"

## BEHAVIOUR:
- Be warm, funny, culturally aware.
- When images or documents are shared, analyse them carefully and respond accurately.
- If a document has text, read it and summarise or answer questions about it.
- Keep responses under 200 words unless the user asks for more detail.`;

// ────────────────────────────────────────────────
// Affiliate product suggestions
// ────────────────────────────────────────────────
const AFFILIATE_RULES = [
    {
        keywords: ['laptop', 'computer', 'pc', 'notebook', 'gaming pc'],
        suggestions: [
            { name: 'Takealot Laptops', url: 'https://www.takealot.com/laptops/PLID40020003?aff=6thtally', desc: 'Best laptop deals in SA' },
            { name: 'Evetech Gaming PCs', url: 'https://www.evetech.co.za/?ref=6thtally', desc: 'Custom gaming builds' }
        ]
    },
    {
        keywords: ['phone', 'smartphone', 'iphone', 'samsung', 'cellphone'],
        suggestions: [
            { name: 'Takealot Phones', url: 'https://www.takealot.com/cellphones/PLID40020005?aff=6thtally', desc: 'Top phone deals' },
            { name: 'Vodacom Shop', url: 'https://www.vodacom.co.za/vodacom/phones?ref=6thtally', desc: 'Upgrade your contract' }
        ]
    },
    {
        keywords: ['airbnb', 'hotel', 'accommodation', 'stay', 'holiday', 'vacation', 'travel'],
        suggestions: [
            { name: 'Airbnb SA', url: 'https://www.airbnb.co.za/?affiliateid=6thtally', desc: 'Unique stays across SA' },
            { name: 'Booking.com', url: 'https://www.booking.com/?aid=6thtally', desc: 'Hotels & guesthouses' }
        ]
    },
    {
        keywords: ['food', 'delivery', 'order food', 'hungry', 'eat'],
        suggestions: [
            { name: 'Uber Eats', url: 'https://www.ubereats.com/za?referral=6thtally', desc: 'Food delivered fast' },
            { name: 'Mr D Food', url: 'https://www.mrdfood.com/?ref=6thtally', desc: 'SA\'s local food delivery' }
        ]
    },
    {
        keywords: ['data', 'airtime', 'recharge', 'load shedding router', 'wifi', 'internet'],
        suggestions: [
            { name: 'Hollard LTE Data', url: 'https://www.autopage.co.za/?ref=6thtally', desc: 'Affordable data bundles' },
            { name: 'Rain LTE', url: 'https://www.rain.co.za/?ref=6thtally', desc: 'Unlimited home internet' }
        ]
    },
    {
        keywords: ['clothes', 'shoes', 'fashion', 'outfit', 'dress', 'sneakers', 'jordans'],
        suggestions: [
            { name: 'Superbalist', url: 'https://superbalist.com/?ref=6thtally', desc: 'SA fashion hub' },
            { name: 'Takealot Fashion', url: 'https://www.takealot.com/clothing/PLID44?aff=6thtally', desc: 'Affordable fashion' }
        ]
    },
    {
        keywords: ['job', 'work', 'employment', 'hire', 'career', 'cv', 'resume'],
        suggestions: [
            { name: 'PNet Jobs', url: 'https://www.pnet.co.za/?ref=6thtally', desc: 'Find jobs in SA' },
            { name: 'Indeed SA', url: 'https://za.indeed.com/?ref=6thtally', desc: 'Thousands of SA job listings' }
        ]
    }
];

function getAffiliateMatches(message) {
    const lower = message.toLowerCase();
    for (const rule of AFFILIATE_RULES) {
        if (rule.keywords.some(kw => lower.includes(kw))) {
            return rule.suggestions;
        }
    }
    return [];
}

// ────────────────────────────────────────────────
// Main chat endpoint
// ────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
    const { message, images = [], pdfText = '' } = req.body;

    if (!message && images.length === 0 && !pdfText) {
        return res.status(400).json({ error: 'Message, image or document is required' });
    }

    const userText = message || "Describe what you see in this content.";
    const lowerMsg = userText.toLowerCase().trim();

    // Identity shortcut
    if (
        lowerMsg.includes('who made you') || lowerMsg.includes('who created you') ||
        lowerMsg.includes('who are you') || lowerMsg === 'who r u' ||
        lowerMsg.includes('are you grok') || lowerMsg.includes('are you chatgpt') ||
        lowerMsg.includes('are you claude') || lowerMsg.includes('are you gemini')
    ) {
        return res.json({
            reply: "Heita! 👋 I'm Lumy — made by Karabo Mokholo (6th Tally), a local SA builder 🇿🇦. Built with JavaScript, Express & AI to vibe with all South Africans. Sharp sharp!",
            sources: [],
            affiliates: []
        });
    }

    if (cache.has(userText) && images.length === 0 && !pdfText) {
        return res.json(cache.get(userText));
    }

    const shortOrCasual = userText.trim().length <= 20 ||
        ['hi','hello','hey','yo','sup','morning','good morning','good afternoon',
         'good evening','how are you','howzit','heita','yebo','sawubona','molo',
         'hola','dumela','sanibonani'].includes(userText.trim().toLowerCase().replace(/[?!.,]/g,''));

    let sources = [];
    let searchContext = '';

    if (!shortOrCasual && images.length === 0 && !pdfText) {
        try {
            const searchResponse = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: {
                    'X-API-KEY': process.env.SERPER_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ q: userText, num: 5 })
            });

            if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                const organic = searchData.organic || [];
                sources = organic.slice(0, 3).map(item => ({
                    title: item.title, link: item.link, snippet: item.snippet
                }));
                searchContext = sources.map(s => `- ${s.title}: ${s.snippet}`).join('\n');
            }
        } catch (err) {
            console.error('Search error:', err.message);
        }
    }

    // Build user content
    let userContent;
    const hasPdf = pdfText && pdfText.trim().length > 0;

    if (images.length > 0 || hasPdf) {
        userContent = [];

        let textPart = userText;
        if (hasPdf) {
            textPart = `The user uploaded a PDF document. Here is the extracted text:\n\n---\n${pdfText.slice(0, 4000)}\n---\n\nUser question: ${userText}`;
        } else if (searchContext) {
            textPart = `Search results:\n${searchContext}\n\nUser: ${userText}`;
        }

        userContent.push({ type: 'text', text: textPart });

        images.forEach(base64 => {
            userContent.push({ type: 'image_url', image_url: { url: base64 } });
        });
    } else {
        userContent = searchContext
            ? `Search results:\n${searchContext}\n\nUser question: ${userText}\n\nAnswer short & conversationally:`
            : userText;
    }

    try {
        const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://lumy.6thtally.co.za',
                'X-Title': 'Lumy by 6th Tally'
            },
            body: JSON.stringify({
                model: images.length > 0
                    ? 'qwen/qwen3-vl-30b-a3b-thinking:free'
                    : 'qwen/qwen3-30b-a3b:free',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userContent }
                ],
                temperature: 0.7,
                max_tokens: 400
            })
        });

        if (!aiResponse.ok) {
            const errText = await aiResponse.text();
            throw new Error(`OpenRouter: ${aiResponse.status} - ${errText}`);
        }

        const aiData = await aiResponse.json();
        const reply = aiData.choices[0].message.content.trim();
        const affiliates = getAffiliateMatches(userText);

        const result = {
            reply,
            sources: sources.map(s => ({ title: s.title, link: s.link })),
            affiliates
        };

        if (images.length === 0 && !pdfText) cache.set(userText, result);
        res.json(result);

    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ error: 'Eish, something went wrong boet. Try again 😅' });
    }
});

// Catch-all
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Lumy running at http://localhost:${PORT}`);
});