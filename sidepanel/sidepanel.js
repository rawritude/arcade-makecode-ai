// MakeCode AI Assistant - Sidepanel Script

// State
let projectCode = '';
let editorMode = 'blocks'; // 'blocks' or 'typescript'
let messages = [];
let isStreaming = false;
let complexity = 3; // Default: balanced

// Complexity level labels
const complexityLabels = {
    1: 'Super Simple 🎈',
    2: 'Easy',
    3: 'Balanced',
    4: 'Detailed',
    5: 'Advanced 🔧'
};

// DOM Elements
const messagesContainer = document.getElementById('messages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const refreshCodeBtn = document.getElementById('refreshCode');
const clearChatBtn = document.getElementById('clearChat');
const toggleCodeBtn = document.getElementById('toggleCode');
const codePanel = document.getElementById('codePanel');
const codeDisplay = document.getElementById('codeDisplay').querySelector('code');
const codeStatus = document.getElementById('codeStatus');
const modelName = document.getElementById('modelName');
const complexitySlider = document.getElementById('complexitySlider');
const complexityValue = document.getElementById('complexityValue');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await extractCode();
    setupEventListeners();
});

// Load settings
async function loadSettings() {
    const settings = await chrome.storage.sync.get(['model', 'complexity']);
    if (settings.model) {
        modelName.textContent = settings.model.replace('gemini-', '').replace('-preview', '');
    }
    if (settings.complexity) {
        complexity = settings.complexity;
        complexitySlider.value = complexity;
        complexityValue.textContent = complexityLabels[complexity];
    }
}

// Extract code from page
async function extractCode() {
    codeStatus.textContent = 'Loading...';
    codeStatus.className = 'code-status';

    try {
        // Request code extraction from background
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'doExtractCode' }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        if (response?.success && response.data) {
            projectCode = response.data.mainTs || '';
            editorMode = response.data.editorMode || 'blocks';

            console.log('[MakeCode AI] Editor mode detected:', editorMode);

            if (projectCode) {
                codeDisplay.textContent = projectCode;
                const modeLabel = editorMode === 'blocks' ? '📦 Blocks' : '📝 TypeScript';
                codeStatus.textContent = `${projectCode.split('\n').length} lines • ${modeLabel}`;
                codeStatus.className = 'code-status loaded';
            } else {
                // Check allFiles for any TypeScript
                const files = response.data.allFiles || {};
                const tsFile = Object.entries(files).find(([key]) => key.endsWith('.ts'));
                if (tsFile) {
                    projectCode = tsFile[1];
                    codeDisplay.textContent = projectCode;
                    const modeLabel = editorMode === 'blocks' ? '📦 Blocks' : '📝 TypeScript';
                    codeStatus.textContent = `${projectCode.split('\n').length} lines • ${modeLabel}`;
                    codeStatus.className = 'code-status loaded';
                } else {
                    codeStatus.textContent = 'No code found';
                    codeStatus.className = 'code-status error';
                }
            }
        } else {
            codeStatus.textContent = response?.error || 'Failed to extract';
            codeStatus.className = 'code-status error';
        }
    } catch (error) {
        codeStatus.textContent = 'Connection error';
        codeStatus.className = 'code-status error';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Send message
    sendBtn.addEventListener('click', sendMessage);

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
        sendBtn.disabled = !userInput.value.trim() || isStreaming;
    });

    // Refresh code
    refreshCodeBtn.addEventListener('click', extractCode);

    // Clear chat
    clearChatBtn.addEventListener('click', () => {
        messages = [];
        messagesContainer.innerHTML = getWelcomeHTML();
        setupQuickPrompts();
    });

    // Toggle code panel
    toggleCodeBtn.addEventListener('click', () => {
        codePanel.classList.toggle('collapsed');
    });

    // Complexity slider
    complexitySlider.addEventListener('input', (e) => {
        complexity = parseInt(e.target.value);
        complexityValue.textContent = complexityLabels[complexity];
    });

    complexitySlider.addEventListener('change', (e) => {
        // Save to storage when released
        chrome.runtime.sendMessage({
            action: 'saveComplexity',
            complexity: parseInt(e.target.value)
        });
    });

    // Quick prompts
    setupQuickPrompts();

    // Listen for streaming messages
    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'streamChunk') {
            appendToLastMessage(request.text);
        } else if (request.action === 'streamEnd') {
            finishStreaming();
        } else if (request.action === 'streamError') {
            showError(request.error);
            finishStreaming();
        }
    });
}

function setupQuickPrompts() {
    document.querySelectorAll('.quick-prompt').forEach(btn => {
        btn.addEventListener('click', () => {
            userInput.value = btn.dataset.prompt;
            sendBtn.disabled = false;
            sendMessage();
        });
    });
}

// Send message
async function sendMessage() {
    const text = userInput.value.trim();
    if (!text || isStreaming) return;

    if (!projectCode) {
        showError('No code loaded. Make sure you have a project open in MakeCode Arcade.');
        return;
    }

    const settings = await chrome.storage.sync.get(['apiKey']);
    if (!settings.apiKey) {
        showError('API key not configured. Click the extension icon to set it up.');
        return;
    }

    // Get current editor mode from the page DOM
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getEditorMode' });
            if (response?.editorMode) {
                editorMode = response.editorMode;
                console.log('[MakeCode AI] Updated editor mode from DOM:', editorMode);
            }
        }
    } catch (e) {
        console.log('[MakeCode AI] Could not get editor mode from DOM, using:', editorMode);
    }

    // Clear welcome message if first message
    if (messages.length === 0) {
        messagesContainer.innerHTML = '';
    }

    // Add user message
    messages.push({ role: 'user', content: text });
    addMessageToUI('user', text);

    // Clear input
    userInput.value = '';
    userInput.style.height = 'auto';
    sendBtn.disabled = true;

    // Start streaming
    isStreaming = true;
    addTypingIndicator();

    // Send to background with complexity level and editor mode
    chrome.runtime.sendMessage({
        action: 'streamToGemini',
        messages: messages,
        code: projectCode,
        complexity: complexity,
        editorMode: editorMode
    });
}

// Add message to UI
function addMessageToUI(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.innerHTML = `
    <div class="message-content">${formatMessage(content)}</div>
  `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

// Format message (handle code blocks, markdown)
function formatMessage(text) {
    let formatted = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Code blocks
    formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
    });

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
}

// Add typing indicator
function addTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message assistant';
    indicator.id = 'typingIndicator';
    indicator.innerHTML = `
    <div class="message-content typing-indicator">
      <span></span><span></span><span></span>
    </div>
  `;
    messagesContainer.appendChild(indicator);
    scrollToBottom();
}

// Remove typing indicator
function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

// Append text to last assistant message (streaming)
let currentAssistantMessage = '';

function appendToLastMessage(text) {
    removeTypingIndicator();
    currentAssistantMessage += text;

    let lastMessage = messagesContainer.querySelector('.message.assistant:last-child:not(#typingIndicator)');

    if (!lastMessage || lastMessage.dataset.complete === 'true') {
        lastMessage = document.createElement('div');
        lastMessage.className = 'message assistant';
        lastMessage.innerHTML = '<div class="message-content"></div>';
        messagesContainer.appendChild(lastMessage);
    }

    const content = lastMessage.querySelector('.message-content');
    content.innerHTML = formatMessage(currentAssistantMessage);
    scrollToBottom();
}

// Finish streaming
function finishStreaming() {
    isStreaming = false;
    removeTypingIndicator();

    if (currentAssistantMessage) {
        messages.push({ role: 'assistant', content: currentAssistantMessage });
        const lastMessage = messagesContainer.querySelector('.message.assistant:last-child');
        if (lastMessage) lastMessage.dataset.complete = 'true';
    }

    currentAssistantMessage = '';
    sendBtn.disabled = !userInput.value.trim();
}

// Show error
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    messagesContainer.appendChild(errorDiv);
    scrollToBottom();

    setTimeout(() => errorDiv.remove(), 5000);
}

// Scroll to bottom
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Get welcome HTML
function getWelcomeHTML() {
    return `
    <div class="welcome-message">
      <div class="welcome-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
          <path d="M2 17l10 5 10-5"></path>
          <path d="M2 12l10 5 10-5"></path>
        </svg>
      </div>
      <h2>Hi! I'm your MakeCode AI Assistant</h2>
      <p>I can help you debug your code, explain how things work, or suggest improvements.</p>
      <p class="hint">Use the slider above to adjust how simply I explain things! 🎮</p>
      <div class="quick-prompts">
        <button class="quick-prompt" data-prompt="What does my code do?">What does my code do?</button>
        <button class="quick-prompt" data-prompt="Find bugs in my code">Find bugs</button>
        <button class="quick-prompt" data-prompt="How can I improve my game?">Suggest improvements</button>
      </div>
    </div>
  `;
}
