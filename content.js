// MakeCode Arcade AI Assistant - Content Script
// Adds floating button and detects editor mode from DOM

// Detect which editor mode is active by checking DOM elements
function detectEditorMode() {
  // Check for active blocks menu item
  const blocksActive = document.querySelector('.blocks-menuitem.selected.active');
  if (blocksActive) return 'blocks';

  // Check for active JavaScript menu item  
  const jsActive = document.querySelector('.javascript-menuitem.selected.active');
  if (jsActive) return 'typescript';

  // Check for Python menu item (for future compatibility)
  const pythonActive = document.querySelector('.python-menuitem.selected.active');
  if (pythonActive) return 'python';

  // Fallback: check if blocks editor is visible
  const blocksEditor = document.querySelector('#blocksEditor');
  if (blocksEditor && blocksEditor.style.display !== 'none') return 'blocks';

  // Default to blocks (most common for young learners)
  return 'blocks';
}

// Create floating action button
function createFloatingButton() {
  if (document.getElementById('makecode-ai-fab')) return;

  const fab = document.createElement('button');
  fab.id = 'makecode-ai-fab';
  fab.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      <path d="M12 7v6"></path>
      <path d="M9 10h6"></path>
    </svg>
  `;
  fab.title = 'Open AI Assistant';

  fab.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openSidePanel' });
  });

  document.body.appendChild(fab);
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getEditorMode') {
    const mode = detectEditorMode();
    console.log('[MakeCode AI] Detected editor mode from DOM:', mode);
    sendResponse({ editorMode: mode });
    return true;
  }
});

// Initialize
function init() {
  setTimeout(createFloatingButton, 2000);
  console.log('[MakeCode AI] Content script loaded');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
