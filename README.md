# MakeCode Arcade AI Assistant

A Chrome extension that provides AI-powered assistance for MakeCode Arcade projects. Get help with debugging, code explanations, and suggestions directly within the MakeCode editor.

<img width="1906" height="965" alt="image" src="https://github.com/user-attachments/assets/cda2dd75-a714-48b7-8337-00556ce18a6d" />

## Features

- **Automatic Code Extraction**: Reads your project code from MakeCode's IndexedDB storage
- **Editor Mode Detection**: Automatically detects if you're using Blocks or JavaScript/TypeScript editor
- **Adjustable Complexity**: Slider to control explanation level from beginner-friendly (ages 8-10) to advanced
- **Streaming Responses**: Real-time AI responses using Google Gemini API
- **Context-Aware Help**: AI understands MakeCode Arcade APIs and provides appropriate guidance

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the extension folder
5. Click the extension icon and enter your Google Gemini API key

## Getting a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key and paste it in the extension settings

## Usage

1. Open a project in [MakeCode Arcade](https://arcade.makecode.com)
2. Click the purple chat button that appears on the page
3. The side panel will open with your code loaded
4. Adjust the complexity slider based on your experience level
5. Ask questions about your code or request help

### Complexity Levels

| Level | Description |
|-------|----------|-------------|
| 1 | Very simple words, fun analogies, encouraging |
| 2 | Simple language, basic programming terms |
| 3 | Standard terminology, clear examples |
| 4 | Technical terms, patterns, optimizations |
| 5 | Concise, expert-level explanations |

### Editor Mode Support

The extension automatically detects which editor you're using:

- **Blocks Editor**: AI provides instructions using block names and categories (e.g., "Drag the 'set mySprite' block from Sprites")
- **JavaScript Editor**: AI provides TypeScript code examples using MakeCode APIs

## Project Structure

```
arcade-makecode-ai/
├── manifest.json          # Chrome extension manifest (V3)
├── background.js          # Service worker for API calls
├── content.js             # Injected script for MakeCode pages
├── popup/
│   ├── popup.html         # Settings popup UI
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
├── sidepanel/
│   ├── sidepanel.html     # Chat interface
│   ├── sidepanel.css      # Chat styles
│   └── sidepanel.js       # Chat logic
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Technical Details

### Chrome Extension APIs Used

- `chrome.storage.sync` - Secure API key storage
- `chrome.sidePanel` - Chat interface
- `chrome.scripting` - Code extraction from page context
- `chrome.tabs` - Tab communication

### MakeCode Integration

The extension reads project data from MakeCode's IndexedDB database:

- Database: `__pxt_idb_workspace_arcade___default`
- Object Store: `texts`
- Structure: `{ id, files: { "main.ts": "...", "main.blocks": "..." } }`

### AI Integration

- Model: Google Gemini (configurable, default: gemini-3-flash-preview)
- Streaming: SSE-based streaming for real-time responses
- Context: Includes user's code and editor mode in system prompt

## Privacy

- API keys are stored locally in Chrome's sync storage
- Code is only sent to Google's Gemini API when you ask a question
- No data is stored on external servers

## Requirements

- Google Chrome (version 116 or later for side panel support)
- Google Gemini API key
- Active internet connection

## License

MIT License
