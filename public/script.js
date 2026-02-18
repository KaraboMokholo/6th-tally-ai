// script.js
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const chatHistory = document.getElementById('chat-history');

// State
let conversations = []; // Array of { id, title, messages }
let currentConversationId = null;
let cache = new Map(); // Simple in-memory cache: query -> { reply, sources }

// Load or create a new conversation
function loadConversation(id) {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;

    currentConversationId = id;
    renderMessages(conv.messages);
    updateHistorySidebar();
}

// Render messages in the chat area
function renderMessages(messages) {
    chatMessages.innerHTML = '';
    messages.forEach(msg => {
        appendMessage(msg.content, msg.role, msg.sources);
    });
}

// Append a single message to the UI (with timestamp)
function appendMessage(text, sender, sources = null) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.textContent = text;
    messageDiv.appendChild(contentDiv);

    // Add timestamp
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-ZA', { 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
    }).replace(/^0+/, ''); // e.g. "11:42 PM"
    const timestamp = document.createElement('span');
    timestamp.classList.add('timestamp');
    timestamp.textContent = timeString;
    messageDiv.appendChild(timestamp);

    if (sources && sources.length > 0 && (text.includes('search results') || text.includes('based on') || text.length > 150)) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.classList.add('sources');
        sourcesDiv.innerHTML = '<strong>Sources:</strong> ';
        sources.forEach((source, index) => {
            const link = document.createElement('a');
            link.href = source.link;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.classList.add('source-link');
            link.textContent = source.title || `Source ${index+1}`;
            sourcesDiv.appendChild(link);
        });
        messageDiv.appendChild(sourcesDiv);
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Typing indicator ("Lumy is typing...")
function showThinking() {
    const thinkingDiv = document.createElement('div');
    thinkingDiv.classList.add('message', 'bot');
    thinkingDiv.id = 'thinking-indicator';
    thinkingDiv.innerHTML = `
        <div class="message-content typing">
            <span>Lumy is typing</span>
            <span class="typing-dots"></span>
        </div>
    `;
    chatMessages.appendChild(thinkingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeThinking() {
    const indicator = document.getElementById('thinking-indicator');
    if (indicator) indicator.remove();
}

// Send message
async function sendMessage() {
    const message = userInput.value.trim();
    if (message === '') return;

    userInput.disabled = true;
    sendBtn.disabled = true;

    appendMessage(message, 'user');

    if (!currentConversationId) {
        createNewConversation();
    }
    const conv = conversations.find(c => c.id === currentConversationId);
    conv.messages.push({ role: 'user', content: message });

    userInput.value = '';
    userInput.style.height = 'auto';

    // Show typing indicator IMMEDIATELY
    showThinking();

    try {
        let cached = cache.get(message);
        if (cached) {
            setTimeout(() => {
                removeThinking();
                appendMessage(cached.reply, 'bot', cached.sources);
                conv.messages.push({ role: 'bot', content: cached.reply, sources: cached.sources });
                updateHistorySidebar();
            }, 500);
        } else {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();
            const { reply, sources } = data;

            cache.set(message, { reply, sources });

            removeThinking();
            appendMessage(reply, 'bot', sources);
            conv.messages.push({ role: 'bot', content: reply, sources });
            updateHistorySidebar();
        }
    } catch (error) {
        removeThinking();
        appendMessage('Eish, something went wrong. Try again?', 'bot');
        console.error('Error:', error);
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

// Create a new conversation + auto welcome message
function createNewConversation() {
    const id = Date.now().toString();
    const newConv = {
        id,
        title: 'New Chat',
        messages: []
    };
    conversations.push(newConv);
    currentConversationId = id;

    chatMessages.innerHTML = ''; // Clear messages

    // Add welcome message from Lumy
    const welcomeMsg = {
        role: 'bot',
        content: "Sawubona! 👋 I'm Lumy — your South African AI sidekick. How can I help today? (Ask about jobs, news, braai spots, load shedding schedules, or anything else 😄)"
    };
    newConv.messages.push(welcomeMsg);
    appendMessage(welcomeMsg.content, 'bot');

    updateHistorySidebar();
}

// Update the history list in sidebar
function updateHistorySidebar() {
    chatHistory.innerHTML = '';
    conversations.forEach(conv => {
        const firstUserMsg = conv.messages.find(m => m.role === 'user');
        const title = firstUserMsg ? firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '…' : '') : 'New Chat';
        conv.title = title;

        const item = document.createElement('div');
        item.classList.add('history-item');
        if (conv.id === currentConversationId) item.classList.add('active');
        item.textContent = title;
        item.dataset.id = conv.id;
        item.addEventListener('click', () => loadConversation(conv.id));
        chatHistory.appendChild(item);
    });
}

// New chat button
newChatBtn.addEventListener('click', () => {
    createNewConversation();
});

// Send on button click
sendBtn.addEventListener('click', sendMessage);

// Send on Enter (no Shift)
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize textarea
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Initialize: create a default conversation
createNewConversation();

// Sidebar toggle for mobile
const menuToggle = document.getElementById('menu-toggle');
const closeSidebar = document.getElementById('close-sidebar');
const sidebar = document.querySelector('.sidebar');

if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.add('open');
    });
}

if (closeSidebar && sidebar) {
    closeSidebar.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });

    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !menuToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

// ────────────────────────────────────────────────
// Dark / Light Mode with Material Icons
// ────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const html = document.documentElement;

function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update icon
    themeIcon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
}

// Load saved theme or default to light
const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

// Toggle on click
themeToggle.addEventListener('click', () => {
    const current = html.getAttribute('data-theme') || 'light';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
});

// ────────────────────────────────────────────────
// Shooting Stars (random in dark mode)
// ────────────────────────────────────────────────
function createStar() {
    const star = document.createElement('div');
    star.classList.add('star');
    const size = Math.random() * 3 + 1;
    star.style.width = star.style.height = `${size}px`;
    star.style.left = `${Math.random() * 100}vw`;
    star.style.top = `-${size}px`;
    star.style.animationDuration = `${Math.random() * 6 + 4}s`;
    star.style.animationDelay = `${Math.random() * 5}s`;
    document.querySelector('.stars').appendChild(star);

    setTimeout(() => star.remove(), 10000);
}

setInterval(() => {
    if (html.getAttribute('data-theme') === 'dark') {
        createStar();
    }
}, 800);

// ────────────────────────────────────────────────
// Google Login
// ────────────────────────────────────────────────
function handleGoogleLogin(response) {
    try {
        const data = JSON.parse(atob(response.credential.split('.')[1]));
        
        document.getElementById('google-signin-container').style.display = 'none';
        
        const profile = document.getElementById('logged-in-profile');
        profile.style.display = 'flex';
        
        const name = data.given_name || data.name || 'User';
        document.getElementById('user-avatar').textContent = name.charAt(0) || '👤';
        
        const email = data.email || 'user@gmail.com';
        document.getElementById('user-email').textContent = email;
        
        localStorage.setItem('user', JSON.stringify({ name, email }));
    } catch (err) {
        console.error('Google login error:', err);
    }
}

window.addEventListener('load', () => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        const { name, email } = JSON.parse(savedUser);
        document.getElementById('google-signin-container').style.display = 'none';
        document.getElementById('logged-in-profile').style.display = 'flex';
        document.getElementById('user-avatar').textContent = name.charAt(0) || '👤';
        document.getElementById('user-email').textContent = email;
    }
});

// ────────────────────────────────────────────────
// Share Chat
// ────────────────────────────────────────────────
document.getElementById('share-btn').addEventListener('click', () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        alert('Conversation link copied! Share it with friends.');
    }).catch(() => {
        alert('Copy failed – here is the link: ' + url);
    });
});