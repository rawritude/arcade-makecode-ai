// MakeCode Arcade AI Assistant - Background Service Worker
// Clean implementation after determining IndexedDB structure

const MAKECODE_DB = '__pxt_idb_workspace_arcade___default';

const hasChromeRuntime = typeof chrome !== 'undefined' && chrome.runtime;

if (hasChromeRuntime) {
  // Open side panel when extension icon is clicked
  chrome.action.onClicked.addListener((tab) => {
    if (tab.url?.includes('arcade.makecode.com')) {
      chrome.sidePanel.open({ tabId: tab.id });
    }
  });

  // Enable side panel for MakeCode Arcade pages
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.url?.includes('arcade.makecode.com')) {
      chrome.sidePanel.setOptions({
        tabId,
        path: 'sidepanel/sidepanel.html',
        enabled: true
      });
    }
  });

  // Message handler
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'openSidePanel') {
      if (sender.tab?.id) {
        chrome.sidePanel.open({ tabId: sender.tab.id });
      }
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'streamToGemini') {
      handleGeminiStream(request.messages, request.code, request.complexity, request.editorMode);
      sendResponse({ success: true, streaming: true });
      return true;
    }

    if (request.action === 'getSettings') {
      chrome.storage.sync.get(['apiKey', 'model', 'complexity'], (result) => {
        sendResponse(result);
      });
      return true;
    }

    if (request.action === 'saveComplexity') {
      chrome.storage.sync.set({ complexity: request.complexity });
      sendResponse({ success: true });
      return true;
    }

    if (request.action === 'doExtractCode') {
      handleExtractCode()
        .then(data => sendResponse({ success: true, data }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
    }
  });
}

// Extract code using chrome.scripting in MAIN world
async function handleExtractCode() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url?.includes('arcade.makecode.com')) {
    throw new Error('Not on MakeCode Arcade page');
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: extractFromPage
  });

  if (!results?.[0]?.result) {
    throw new Error('Extraction failed');
  }

  const result = results[0].result;
  if (result.error) throw new Error(result.error);
  return result;
}

// Runs in page context - clean extraction knowing the structure
function extractFromPage() {
  return (async () => {
    try {
      // MakeCode Arcade stores projects in this database
      const DB_NAMES = [
        '__pxt_idb_workspace_arcade___default',
        '__pxt_idb_workspace_arcade__default'
      ];

      for (const dbName of DB_NAMES) {
        try {
          const result = await extractFromDb(dbName);
          if (result.mainTs) return result;
        } catch (e) {
          // Try next database
        }
      }

      return { error: 'No project code found. Make sure you have a project open.' };

    } catch (e) {
      return { error: e.message };
    }

    function extractFromDb(name) {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(name);
        req.onerror = () => reject(new Error('Failed to open database'));
        req.onupgradeneeded = (e) => {
          e.target.transaction.abort();
          reject(new Error('Database not found'));
        };

        req.onsuccess = (e) => {
          const db = e.target.result;
          const stores = Array.from(db.objectStoreNames);

          if (!stores.includes('texts')) {
            db.close();
            reject(new Error('No texts store'));
            return;
          }

          const tx = db.transaction(['texts'], 'readonly');
          const store = tx.objectStore('texts');
          const getAll = store.getAll();

          getAll.onsuccess = () => {
            db.close();
            const items = getAll.result;
            const data = { mainTs: null, mainBlocks: null, editorMode: 'typescript', allFiles: {} };

            // MakeCode structure: { id, files: { "main.ts": "...", "main.blocks": "...", ... } }
            for (const item of items) {
              if (item?.files && typeof item.files === 'object') {
                Object.entries(item.files).forEach(([filename, content]) => {
                  if (typeof content === 'string') {
                    data.allFiles[filename] = content;
                    if (filename === 'main.ts') {
                      data.mainTs = content;
                    }
                    if (filename === 'main.blocks') {
                      data.mainBlocks = content;
                    }
                  }
                });
              }
            }

            // Detect editor mode: if main.blocks has content, user is likely using blocks
            if (data.mainBlocks && data.mainBlocks.length > 50) {
              data.editorMode = 'blocks';
            }

            resolve(data);
          };

          getAll.onerror = () => {
            db.close();
            reject(new Error('Failed to read data'));
          };
        };
      });
    }
  })();
}

// Build system prompt based on complexity level and editor mode
function buildSystemPrompt(code, complexity, editorMode = 'blocks') {
  const isBlocks = editorMode === 'blocks';

  const complexityDescriptions = {
    1: `You are helping a young beginner (ages 8-10) who is just starting to learn programming.
- Use very simple words and short sentences
- Explain concepts like you're talking to a curious child
- Use fun analogies (games, toys, animals)
- Be encouraging and patient
- Avoid technical jargon entirely
- Use emojis to make it friendly 🎮`,

    2: `You are helping a student (ages 10-14) learning to code through MakeCode Arcade.
- Use simple language but can introduce basic programming terms
- Explain what code does step by step
- Give practical examples
- Be encouraging and supportive`,

    3: `You are helping someone with basic programming knowledge.
- Can use standard programming terminology
- Explain concepts clearly with examples
- Suggest improvements and best practices
- Be helpful and constructive`,

    4: `You are helping an intermediate programmer.
- Use proper technical terminology
- Discuss code patterns and architecture
- Suggest optimizations and advanced techniques
- Be concise and direct`,

    5: `You are helping an experienced developer.
- Be technical and precise
- Focus on efficiency and best practices
- Suggest advanced patterns
- Be concise, skip basic explanations`
  };

  const levelDesc = complexityDescriptions[complexity] || complexityDescriptions[3];

  // Different instructions based on editor mode
  const editorInstructions = isBlocks ? `
CRITICAL: The user is using the BLOCKS EDITOR (drag-and-drop visual programming), NOT the TypeScript/JavaScript editor.

When helping:
- NEVER show TypeScript/JavaScript code snippets
- Describe which BLOCKS to use and where to find them in the toolbox
- Use block names like "on start", "set mySprite to sprite of kind Player", "move mySprite with buttons"
- Describe the block categories: Sprites, Controller, Scene, Game, Info, Loops, Logic, Variables, etc.
- Say things like "Drag the 'set mySprite to sprite' block from the Sprites category"
- Describe block colors: Sprites are pink/red, Controller is orange, Scene is blue, etc.
- If they need to create a sprite, tell them to use the "set mySprite to sprite of kind Player" block
- Explain how to click on the gray box in a sprite block to open the image editor` : `
The user is using the TypeScript/JavaScript text editor.

When helping:
- Show TypeScript code examples using MakeCode Arcade APIs
- Use proper syntax with the MakeCode API
- Common patterns: sprites.create(), controller.moveSprite(), scene.setBackgroundColor()`;

  return `${levelDesc}

The user is working in MakeCode Arcade on a game project.
${editorInstructions}

Their current code (auto-generated TypeScript representation):
\`\`\`typescript
${code}
\`\`\`

Important context:
- MakeCode Arcade is a game development platform for making retro-style games
- Common block categories: Sprites, Controller, Scene, Game, Info, Loops, Logic, Variables, Math, Arrays
- Keep responses focused on their specific question
- Be encouraging and helpful!`;
}

// Handle streaming Gemini request
async function handleGeminiStream(messages, code, complexity = 3, editorMode = 'blocks') {
  try {
    const settings = await chrome.storage.sync.get(['apiKey', 'model']);

    if (!settings.apiKey) {
      chrome.runtime.sendMessage({
        action: 'streamError',
        error: 'API key not configured. Click the extension icon to set it up.'
      });
      return;
    }

    const model = settings.model || 'gemini-3-flash-preview';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${settings.apiKey}&alt=sse`;

    const systemPrompt = buildSystemPrompt(code, complexity, editorMode);

    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'I\'m ready to help with your MakeCode Arcade game! What would you like to work on?' }] }
    ];

    messages.forEach(msg => {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
              chrome.runtime.sendMessage({
                action: 'streamChunk',
                text: data.candidates[0].content.parts[0].text
              });
            }
          } catch (e) { }
        }
      }
    }

    chrome.runtime.sendMessage({ action: 'streamEnd' });

  } catch (error) {
    chrome.runtime.sendMessage({
      action: 'streamError',
      error: error.message
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildSystemPrompt
  };
}
