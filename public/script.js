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

// Append a single message to the UI
function appendMessage(text, sender, sources = null) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    contentDiv.textContent = text;
    messageDiv.appendChild(contentDiv);

    if (sources && sources.length > 0 && text.includes('search results') || text.includes('based on') || text.length > 150) {
    // show sources only when it looks like web-augmented answer
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

// Thinking indicator
let thinkingId = null;
function showThinking() {
    const thinkingDiv = document.createElement('div');
    thinkingDiv.classList.add('message', 'bot');
    thinkingDiv.id = 'thinking-indicator';
    thinkingDiv.innerHTML = '<div class="message-content thinking"><span>Thinking</span><span class="thinking-dots"></span></div>';
    chatMessages.appendChild(thinkingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    thinkingId = 'thinking-indicator';
}

function removeThinking() {
    const indicator = document.getElementById('thinking-indicator');
    if (indicator) indicator.remove();
    thinkingId = null;
}

// Send message
async function sendMessage() {
    const message = userInput.value.trim();
    if (message === '') return;

    // Disable input while processing
    userInput.disabled = true;
    sendBtn.disabled = true;

    // Display user message
    appendMessage(message, 'user');

    // Get or create current conversation
    if (!currentConversationId) {
        createNewConversation();
    }
    const conv = conversations.find(c => c.id === currentConversationId);
    conv.messages.push({ role: 'user', content: message });

    userInput.value = '';
    userInput.style.height = 'auto'; // Reset textarea height

    // Show thinking indicator
    showThinking();

    try {
        // Check cache
        let cached = cache.get(message);
        if (cached) {
            // Use cached response
            setTimeout(() => {
                removeThinking();
                appendMessage(cached.reply, 'bot', cached.sources);
                conv.messages.push({ role: 'bot', content: cached.reply, sources: cached.sources });
                updateHistorySidebar(); // Update last message in history
            }, 500); // Simulate a tiny delay
        } else {
            // Call backend
            const response = await fetch('/api/chat', { // Update URL if needed
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();
            const { reply, sources } = data;

            // Cache it
            cache.set(message, { reply, sources });

            removeThinking();
            appendMessage(reply, 'bot', sources);
            conv.messages.push({ role: 'bot', content: reply, sources });
            updateHistorySidebar();
        }
    } catch (error) {
        removeThinking();
        appendMessage('Sorry, I encountered an error. Please try again.', 'bot');
        console.error('Error:', error);
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

// Create a new conversation
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
    updateHistorySidebar();
}

// Update the history list in sidebar
function updateHistorySidebar() {
    chatHistory.innerHTML = '';
    conversations.forEach(conv => {
        // Generate title from first user message or default
        const firstUserMsg = conv.messages.find(m => m.role === 'user');
        const title = firstUserMsg ? firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '…' : '') : 'New Chat';
        conv.title = title; // Update title

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

// Send on Enter (but allow Shift+Enter for new line)
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

    // Optional: close when clicking outside
    document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            !menuToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });
}

// ────────────────────────────────────────────────
// Dark / Light Mode
// ────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
const html = document.documentElement;

function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

const savedTheme = localStorage.getItem('theme') || 'light';
setTheme(savedTheme);

themeToggle.addEventListener('click', () => {
    const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
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
}, 800); // new star every ~0.8s

// ────────────────────────────────────────────────
// Google Login Placeholder (demo)
// ────────────────────────────────────────────────
function handleGoogleLogin(response) {
    try {
        const data = JSON.parse(atob(response.credential.split('.')[1]));
        
        // Hide Google sign-in button
        document.getElementById('google-signin-container').style.display = 'none';
        
        // Show logged-in profile with email
        const profile = document.getElementById('logged-in-profile');
        profile.style.display = 'flex';
        
        // Set name or first letter for avatar
        const name = data.given_name || data.name || 'User';
        document.getElementById('user-avatar').textContent = name.charAt(0) || '👤';
        
        // Show email
        const email = data.email || 'user@gmail.com'; // fallback if email not present
        document.getElementById('user-email').textContent = email;
        
        console.log('Logged in as:', name, email);
        
        // Optional: save to localStorage so it persists on refresh
        localStorage.setItem('user', JSON.stringify({ name, email }));
    } catch (err) {
        console.error('Google login error:', err);
    }
}

// Restore login state on page load
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
// Share Conversation (demo - copy current URL)
// ────────────────────────────────────────────────
document.getElementById('share-btn').addEventListener('click', () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        alert('Conversation link copied! Share it with friends.');
    }).catch(() => {
        alert('Copy failed – here is the link: ' + url);
    });
});