// MakeCode AI Assistant - Popup Script

document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('apiKey');
    const modelSelect = document.getElementById('model');
    const saveBtn = document.getElementById('saveBtn');
    const toggleBtn = document.getElementById('toggleKey');
    const status = document.getElementById('status');

    // Load saved settings
    chrome.storage.sync.get(['apiKey', 'model'], (result) => {
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
        if (result.model) {
            modelSelect.value = result.model;
        }
    });

    // Toggle API key visibility
    toggleBtn.addEventListener('click', () => {
        const isPassword = apiKeyInput.type === 'password';
        apiKeyInput.type = isPassword ? 'text' : 'password';
        toggleBtn.title = isPassword ? 'Hide' : 'Show';
    });

    // Save settings
    saveBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();
        const model = modelSelect.value;

        if (!apiKey) {
            showStatus('Please enter an API key', 'error');
            return;
        }

        // Validate API key format (basic check)
        if (!apiKey.startsWith('AI') && apiKey.length < 30) {
            showStatus('Invalid API key format', 'error');
            return;
        }

        // Test the API key
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span>Testing...</span>';

        try {
            const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(testUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || 'Invalid API key');
            }

            // Save to storage
            await chrome.storage.sync.set({ apiKey, model });
            showStatus('Settings saved successfully!', 'success');

        } catch (error) {
            showStatus(error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span>Save Settings</span>';
        }
    });

    function showStatus(message, type) {
        status.textContent = message;
        status.className = `status ${type}`;

        if (type === 'success') {
            setTimeout(() => {
                status.className = 'status';
            }, 3000);
        }
    }
});
