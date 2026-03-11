// script.js

// ────────────────────────────────────────────────
// PDF.js worker
// ────────────────────────────────────────────────
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ────────────────────────────────────────────────
// DOM refs
// ────────────────────────────────────────────────
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const chatHistory = document.getElementById('chat-history');
const fileUpload = document.getElementById('file-upload');
const attachmentPreview = document.getElementById('attachment-preview');
const previewImg = document.getElementById('preview-img');
const pdfPreviewLabel = document.getElementById('pdf-preview-label');
const pdfFileName = document.getElementById('pdf-file-name');
const removeAttachmentBtn = document.getElementById('remove-attachment');

// ────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────
let conversations = [];
let currentConversationId = null;
let cache = new Map();
let attachedImage = null;   // base64 string
let attachedPdfText = '';   // extracted PDF text
let attachedFileName = '';

// ────────────────────────────────────────────────
// Conversations
// ────────────────────────────────────────────────
function loadConversation(id) {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;
    currentConversationId = id;
    renderMessages(conv.messages);
    updateHistorySidebar();
}

function renderMessages(messages) {
    chatMessages.innerHTML = '';
    messages.forEach(msg => appendMessage(msg.content, msg.role, msg.sources, msg.affiliates));
}

// ────────────────────────────────────────────────
// Render message + optional affiliate cards
// ────────────────────────────────────────────────
function appendMessage(text, sender, sources = null, affiliates = null) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender);

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');
    // Render newlines
    contentDiv.innerHTML = text.replace(/\n/g, '<br>');
    messageDiv.appendChild(contentDiv);

    // Timestamp
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-ZA', {
        hour: '2-digit', minute: '2-digit', hour12: true
    }).replace(/^0+/, '');
    const timestamp = document.createElement('span');
    timestamp.classList.add('timestamp');
    timestamp.textContent = timeString;
    messageDiv.appendChild(timestamp);

    // Sources
    if (sources && sources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.classList.add('sources');
        sourcesDiv.innerHTML = '<strong>Sources:</strong> ';
        sources.forEach((source, i) => {
            const link = document.createElement('a');
            link.href = source.link;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.classList.add('source-link');
            link.textContent = source.title || `Source ${i + 1}`;
            sourcesDiv.appendChild(link);
        });
        messageDiv.appendChild(sourcesDiv);
    }

    chatMessages.appendChild(messageDiv);

    // Affiliate cards (rendered BELOW the message, not inside)
    if (affiliates && affiliates.length > 0) {
        const affDiv = document.createElement('div');
        affDiv.classList.add('affiliate-cards');
        affDiv.innerHTML = `<p class="affiliate-label">🛍️ You might also like:</p>`;
        affiliates.forEach(aff => {
            const card = document.createElement('a');
            card.href = aff.url;
            card.target = '_blank';
            card.rel = 'noopener noreferrer sponsored';
            card.classList.add('affiliate-card');
            card.innerHTML = `
                <span class="aff-name">${aff.name}</span>
                <span class="aff-desc">${aff.desc}</span>
                <span class="aff-cta">Check it out →</span>
            `;
            affDiv.appendChild(card);
        });
        chatMessages.appendChild(affDiv);
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ────────────────────────────────────────────────
// Typing indicator
// ────────────────────────────────────────────────
function showThinking() {
    const thinkingDiv = document.createElement('div');
    thinkingDiv.classList.add('message', 'bot');
    thinkingDiv.id = 'thinking-indicator';
    thinkingDiv.innerHTML = `
        <div class="message-content typing">
            <span>Lumy is typing</span>
            <span class="typing-dots">...</span>
        </div>`;
    chatMessages.appendChild(thinkingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeThinking() {
    const el = document.getElementById('thinking-indicator');
    if (el) el.remove();
}

// ────────────────────────────────────────────────
// Send message
// ────────────────────────────────────────────────
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message && !attachedImage && !attachedPdfText) return;

    userInput.disabled = true;
    sendBtn.disabled = true;

    // Display message with attachment label
    let displayText = message;
    if (attachedImage) displayText += ' 📷 [image attached]';
    if (attachedPdfText) displayText += ` 📄 [${attachedFileName}]`;
    appendMessage(displayText || '(file uploaded)', 'user');

    if (!currentConversationId) createNewConversation();
    const conv = conversations.find(c => c.id === currentConversationId);
    conv.messages.push({ role: 'user', content: displayText || '(file)' });

    userInput.value = '';
    userInput.style.height = 'auto';
    showThinking();

    try {
        const body = { message };
        if (attachedImage) body.images = [attachedImage];
        if (attachedPdfText) body.pdfText = attachedPdfText;

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error('Network error');

        const data = await response.json();
        const { reply, sources, affiliates } = data;

        removeThinking();
        appendMessage(reply, 'bot', sources, affiliates);
        conv.messages.push({ role: 'bot', content: reply, sources, affiliates });

        // Clear attachments
        clearAttachment();
        updateHistorySidebar();

    } catch (error) {
        removeThinking();
        appendMessage('Eish, something went wrong boet. Try again? 😅', 'bot');
        console.error('Error:', error);
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

function clearAttachment() {
    attachedImage = null;
    attachedPdfText = '';
    attachedFileName = '';
    attachmentPreview.style.display = 'none';
    previewImg.style.display = 'none';
    pdfPreviewLabel.style.display = 'none';
    previewImg.src = '';
    fileUpload.value = '';
}

// ────────────────────────────────────────────────
// File upload handler (images + PDFs)
// ────────────────────────────────────────────────
fileUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    attachedFileName = file.name;

    if (file.type === 'application/pdf') {
        // Parse PDF with PDF.js
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) { // max 20 pages
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }
            attachedPdfText = fullText.trim();
            attachedImage = null;

            // Show PDF preview label
            pdfFileName.textContent = file.name;
            pdfPreviewLabel.style.display = 'flex';
            previewImg.style.display = 'none';
            attachmentPreview.style.display = 'block';

        } catch (err) {
            console.error('PDF parse error:', err);
            appendMessage('Eish, could not read that PDF. Try a different one 📄', 'bot');
        }
    } else if (file.type.startsWith('image/')) {
        // Image upload
        const reader = new FileReader();
        reader.onload = (event) => {
            attachedImage = event.target.result;
            attachedPdfText = '';

            previewImg.src = attachedImage;
            previewImg.style.display = 'block';
            pdfPreviewLabel.style.display = 'none';
            attachmentPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

removeAttachmentBtn.addEventListener('click', clearAttachment);

// ────────────────────────────────────────────────
// New conversation
// ────────────────────────────────────────────────
function createNewConversation() {
    const id = Date.now().toString();
    const newConv = { id, title: 'New Chat', messages: [] };
    conversations.push(newConv);
    currentConversationId = id;
    chatMessages.innerHTML = '';

    const welcomeMsg = {
        role: 'bot',
        content: "Sawubona! 👋 I'm Lumy — your South African AI sidekick by 6th Tally.\n\nYou can:\n• Ask me anything in ANY SA language 🇿🇦\n• Upload an image 📷 for me to analyse\n• Upload a PDF 📄 and ask questions about it\n\nHow can I help today? Sharp sharp! 😄"
    };
    newConv.messages.push(welcomeMsg);
    appendMessage(welcomeMsg.content, 'bot');
    updateHistorySidebar();
}

function updateHistorySidebar() {
    chatHistory.innerHTML = '';
    conversations.forEach(conv => {
        const firstUserMsg = conv.messages.find(m => m.role === 'user');
        const title = firstUserMsg
            ? firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '…' : '')
            : 'New Chat';
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

newChatBtn.addEventListener('click', () => createNewConversation());
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
userInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = this.scrollHeight + 'px';
});

createNewConversation();

// ────────────────────────────────────────────────
// Sidebar mobile toggle
// ────────────────────────────────────────────────
const menuToggle = document.getElementById('menu-toggle');
const closeSidebar = document.getElementById('close-sidebar');
const sidebar = document.querySelector('.sidebar');

if (menuToggle) menuToggle.addEventListener('click', () => sidebar.classList.add('open'));
if (closeSidebar) closeSidebar.addEventListener('click', () => sidebar.classList.remove('open'));
document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('open');
    }
});

// ────────────────────────────────────────────────
// Dark / Light Mode
// ────────────────────────────────────────────────
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const html = document.documentElement;

function setTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    themeIcon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
}

setTheme(localStorage.getItem('theme') || 'light');
themeToggle.addEventListener('click', () => {
    setTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

// ────────────────────────────────────────────────
// Shooting Stars
// ────────────────────────────────────────────────
function createStar() {
    const star = document.createElement('div');
    star.classList.add('star');
    const size = Math.random() * 3 + 1;
    star.style.cssText = `width:${size}px;height:${size}px;left:${Math.random() * 100}vw;top:-${size}px;animation-duration:${Math.random() * 6 + 4}s;animation-delay:${Math.random() * 5}s`;
    document.querySelector('.stars').appendChild(star);
    setTimeout(() => star.remove(), 10000);
}
setInterval(() => { if (html.getAttribute('data-theme') === 'dark') createStar(); }, 800);

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
        document.getElementById('user-email').textContent = data.email || 'user@gmail.com';
        localStorage.setItem('user', JSON.stringify({ name, email: data.email }));
    } catch (err) { console.error('Google login error:', err); }
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
    navigator.clipboard.writeText(window.location.href)
        .then(() => alert('Link copied! Share with friends 🔗'))
        .catch(() => alert('Link: ' + window.location.href));
});

// ────────────────────────────────────────────────
// Support Modal
// ────────────────────────────────────────────────
const supportModal = document.getElementById('support-modal-overlay');
const supportBtn = document.getElementById('support-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');
const amountBtns = document.querySelectorAll('.amount-btn');
const customAmountInput = document.getElementById('custom-amount');
const payfastAmountInput = document.getElementById('payfast-amount');

let selectedAmount = 100;

supportBtn.addEventListener('click', () => {
    supportModal.classList.add('visible');
});

modalCloseBtn.addEventListener('click', () => {
    supportModal.classList.remove('visible');
});

supportModal.addEventListener('click', (e) => {
    if (e.target === supportModal) supportModal.classList.remove('visible');
});

amountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        amountBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAmount = parseInt(btn.dataset.amount);
        customAmountInput.value = '';
        payfastAmountInput.value = selectedAmount.toFixed(2);
    });
});

customAmountInput.addEventListener('input', () => {
    const val = parseFloat(customAmountInput.value);
    if (!isNaN(val) && val >= 5) {
        amountBtns.forEach(b => b.classList.remove('selected'));
        selectedAmount = val;
        payfastAmountInput.value = val.toFixed(2);
    }
});