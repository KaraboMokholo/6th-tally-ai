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