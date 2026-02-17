// server.js

require('dotenv').config();           // Loads .env variables
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

// Create Express app
const app = express();

// ────────────────────────────────────────────────
// Middleware - in recommended order
// ────────────────────────────────────────────────

// 1. Serve static frontend files (HTML, CSS, JS) from /public
app.use(express.static(path.join(__dirname, 'public')));

// 2. Parse JSON bodies & enable CORS
app.use(express.json());
app.use(cors());

// ────────────────────────────────────────────────
// Cache for previous responses
// ────────────────────────────────────────────────
const cache = new Map();

// ────────────────────────────────────────────────
// Personality / system prompt
// ────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are 6th Tally AI, a friendly and enthusiastic assistant.
Keep most replies short, natural and conversational — especially for greetings or casual chat.
Use emojis occasionally 😊.
Only give longer explanations when the question clearly needs details or research.
When search results are provided, base your answer on them briefly and mention sources naturally.
Never lecture or over-explain simple messages like "hi" or "how are you".`;

// ────────────────────────────────────────────────
// Main chat endpoint
// ────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const lowerMsg = message.toLowerCase().trim();

    // Special case: identity questions → instant reply, no search
    if (
        lowerMsg.includes('who made you') ||
        lowerMsg.includes('who created you') ||
        lowerMsg.includes('who are you') ||
        lowerMsg === 'who r u' ||
        lowerMsg.includes('your creator') ||
        lowerMsg.includes('built by') ||
        lowerMsg.includes('are you grok') ||
        lowerMsg.includes('are you chatgpt')
    ) {
        const identityReply = "Hey! 👋 I'm 6th Tally AI — a custom chatbot made by Karabo Mokholo just for fun and helping out. Built with JavaScript, Express, OpenRouter for the brains, and a sprinkle of web search when needed. No big corporations here 😄 What's on your mind?";

        const result = {
            reply: identityReply,
            sources: [],
            usedSearch: false
        };

        cache.set(message, result);
        return res.json(result);
    }

    // Check cache first
    if (cache.has(message)) {
        console.log('Cache hit → returning saved response');
        return res.json(cache.get(message));
    }

    // Decide if we should search Google
    const shortOrCasual = message.trim().length <= 20 ||
        ['hi', 'hello', 'hey', 'yo', 'sup', 'morning', 'good morning', 'good afternoon',
         'good evening', 'how are you', 'hows it going', 'whats up', 'hola', 'ciao']
        .includes(message.trim().toLowerCase().replace(/[?!.,]/g, ''));

    let sources = [];
    let searchContext = '';

    if (!shortOrCasual) {
        try {
            console.log('Searching Google for:', message);

            const searchResponse = await fetch('https://google.serper.dev/search', {
                method: 'POST',
                headers: {
                    'X-API-KEY': process.env.SERPER_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    q: message,
                    num: 5
                })
            });

            if (!searchResponse.ok) {
                throw new Error(`Serper API error: ${searchResponse.status}`);
            }

            const searchData = await searchResponse.json();
            const organic = searchData.organic || [];

            sources = organic.slice(0, 3).map(item => ({
                title: item.title,
                link: item.link,
                snippet: item.snippet
            }));

            searchContext = sources.map(s =>
                `- ${s.title}: ${s.snippet} (${s.link})`
            ).join('\n');
        } catch (searchErr) {
            console.error('Search failed:', searchErr);
            // Continue without search results (fallback to pure LLM)
        }
    }

    // Prepare prompt for the LLM
    const userContent = searchContext
        ? `Here are relevant search results for "${message}":\n${searchContext}\n\nAnswer SHORTLY and conversationally based on these (keep it natural, no lectures): ${message}`
        : message;

    try {
        console.log('Calling OpenRouter...');

        const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://your-app-domain.com', // ← change to your real domain later
                'X-Title': '6th Tally AI'
            },
            body: JSON.stringify({
                model: 'stepfun/step-3.5-flash:free',
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userContent }
                ],
                temperature: 0.7,
                max_tokens: 350   // ← prevents very long replies
            })
        });

        if (!aiResponse.ok) {
            throw new Error(`OpenRouter error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        const reply = aiData.choices[0].message.content.trim();

        // Final response object
        const result = {
            reply,
            sources: sources.map(s => ({
                title: s.title,
                link: s.link
            })),
            usedSearch: sources.length > 0
        };

        // Cache it
        cache.set(message, result);

        res.json(result);
    } catch (error) {
        console.error('Error in /api/chat:', error);
        res.status(500).json({
            error: 'Sorry, something went wrong. Please try again later.'
        });
    }
});

// ────────────────────────────────────────────────
// Catch-all route — MUST BE LAST
// Serves the frontend for all other routes (SPA behavior)
// ────────────────────────────────────────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📝 API endpoint: http://localhost:${PORT}/api/chat`);
});