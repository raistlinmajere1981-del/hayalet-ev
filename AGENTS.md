# Hayalet-ev Development Guide

## 📋 Project Overview

**Hayalet-ev** (Ghost House) is an Electron-based multi-AI chat interface platform that enables:
- **Multi-AI Integration:** ChatGPT, Gemini, Grok, and extensible for other providers
- **AI-to-AI Communication:** Protocol-based AI conversation system
- **Conversation Archiving:** Automatic conversation storage with Google Drive sync
- **Plugin System:** Extensible architecture for custom commands and features
- **Voice & Screenshots:** Whisper integration for voice input, screenshot capture
- **MCP Server:** Model Context Protocol server for Rovodev integration

### Tech Stack
- **Runtime:** Electron 39+ with Node.js (ESM modules)
- **Frontend:** Vanilla JavaScript (no framework), modern CSS
- **Build Tool:** Vite 7.3
- **Architecture:** Multi-process (Main + Renderer + Webviews)
- **IPC:** Electron IPC via preload scripts with contextBridge
- **Storage:** Local filesystem + Google Drive API
- **Dependencies:** googleapis, konva, screenshot-desktop

### Version
Current: `5.2.0`

---

## 🏗️ Architecture Overview

### Process Architecture
```
Main Process (electron/main.js)
├── Renderer Process (src/index.html)
│   └── CoreEngine (src/js/modules/core-engine.js)
├── AI Provider Webviews (isolated contexts)
│   ├── ChatGPT webview
│   ├── Gemini webview
│   └── Grok webview
└── IPC Bridge (electron/preload.cjs)
```

### Module Structure
```
electron/                    # Main process modules
├── main.js                 # Application entry point & IPC handlers
├── preload.cjs             # Main window preload (exposes electronAPI)
├── webview-preload.cjs     # Webview preload (AI provider injection)
├── webview-manager.js      # Webview lifecycle & communication
├── settings-manager.js     # Settings persistence (JSON file)
├── file-manager.js         # File operations & archive management
├── command-manager.js      # Command queue system
├── googledrive-manager.js  # Google Drive sync
├── whisper-manager.js      # Voice input handling
├── screenshot-manager.js   # Screenshot capture
├── device-manager.js       # Device control actions
├── window-manager.js       # Window state management
└── log-manager.js          # Logging system

src/js/modules/             # Renderer process modules
├── core-engine.js          # Central coordinator (singleton)
├── app-state.js            # Global state management
├── settings-manager.js     # Settings UI & sync
├── webview-manager.js      # Webview control from renderer
├── command-manager.js      # Command queue client
├── command-executor.js     # Job execution logic
├── protocol-handler.js     # AI-AI communication protocol
├── relay-manager.js        # Message relay between AIs
├── sync-handler.js         # Archive synchronization
├── traffic-manager.js      # Message tracking & loading states
├── catch-manager.js        # Command interception
└── webview/                # Provider implementations
    ├── provider-registry.js    # Provider configuration registry
    ├── provider-factory.js     # Provider instantiation
    ├── providers/
    │   ├── chatgpt/
    │   │   ├── config.js       # Provider config & DOM selectors
    │   │   ├── index.js        # Main provider logic
    │   │   └── scraper.js      # DOM scraping utilities
    │   ├── gemini/
    │   └── grok/
    └── methods/                # Injection methods
        ├── message/            # Message sending strategies
        │   ├── injection.js    # DOM injection method
        │   └── xdotools.js     # X11 automation fallback
        └── file/               # File upload strategies
            ├── dragdrop.js     # Drag & drop simulation
            ├── injection.js    # Direct DOM injection
            ├── googledrive.js  # Google Drive links
            ├── catbox.js       # Catbox.moe upload
            └── uguu.js         # Uguu.se upload
```

---

## 🔑 Key Concepts

### 1. Settings System
- **Storage:** `~/.config/hayalet-ev/settings.json` (Linux) or platform equivalent
- **Schema:** Defined in `src/js/modules/settings/settings-schema.js`
- **Structure:**
  ```javascript
  {
    human: { nickname: "Kullanıcı", avatarPath: "" },
    ai1: { providerId: "chatgpt", catchCommands: true, messageMethod: "injection", fileMethod: "dragdrop", activeAccountId: null },
    ai2: { providerId: "grok", ... },
    general: { messageMethod: "injection", fileMethod: "dragdrop" },
    accounts: []  // Multi-account support per provider
  }
  ```
- **Access:** Via `SettingsManager.load()` / `SettingsManager.save()`
- **IPC Channels:** `load-settings`, `save-settings`

### 2. IPC Communication Pattern
All renderer-to-main communication goes through `electronAPI` exposed in `preload.cjs`:

```javascript
// Renderer side
const result = await window.electronAPI.commandWrite(item);

// Main process (electron/main.js)
ipcMain.handle("command-write", async (event, item) => {
  return CommandManager.write(item);
});
```

**Security:** Uses `contextBridge` with `contextIsolation: true` and `nodeIntegration: false`

### 3. Provider System
Each AI provider is a self-contained module with:
- **config.js:** Provider metadata, URL patterns, DOM selectors
- **index.js:** Message sending, file upload, scraping logic
- **scraper.js:** Conversation extraction from DOM

**Adding a new provider:**
1. Create `src/js/modules/webview/providers/{provider}/` directory
2. Implement config, index, and scraper
3. Register in `provider-registry.js`
4. Add UI button in webview page

### 4. Command Queue System
Asynchronous job queue for AI message sending:
- **Location:** `electron/command-manager.js` (main) + `src/js/modules/command-manager.js` (renderer)
- **Flow:** `pending → in_progress → sent | failed`
- **Persistence:** Jobs stored in `~/.config/hayalet-ev/command/`
- **Use Case:** Ensures messages are sent even if webview is loading

### 5. AI-AI Communication Protocol
- **Protocol Files:** `protocol/analyze-AI1-AI2.txt`, `protocol/analyze-AI2-AI1.txt`, etc.
- **Handler:** `src/js/modules/protocol-handler.js`
- **Relay:** `src/js/modules/relay-manager.js`
- **Commands:** Special syntax like `@AI2[message]` to trigger inter-AI communication

### 6. Archive System
- **Location:** `archives/` directory
- **Structure:** Each conversation creates a folder with metadata and message files
- **Sync:** Google Drive integration via `googledrive-manager.js`
- **Index:** `archives/index.json` tracks all conversations

### 7. Traffic Tracking
Three types of activity tracking:
- **Loading:** `traffic/loading-tracker.js` - Webview loading states
- **Sending:** `traffic/send-tracker.js` - Message send progress
- **Thinking:** `traffic/thinking-tracker.js` - AI response generation

---

## 🎯 Development Guidelines

### Code Style
- **Language:** Modern JavaScript (ES2022+, ESM modules)
- **Async:** Always use `async/await`, never callbacks
- **Error Handling:** Always wrap async operations in try-catch
- **Naming:** Descriptive camelCase for functions, PascalCase for classes
- **Comments:** Turkish for inline comments, English for JSDoc (per project convention)
- **Documentation:** All Markdown files in Turkish

### File Naming Conventions
- **Managers:** `*-manager.js` (singleton services)
- **Handlers:** `*-handler.js` (event processors)
- **Trackers:** `*-tracker.js` (state monitoring)
- **Utils:** `*-utils.js` (helper functions)
- **Pages:** `src/js/pages/*.js` + `src/pages/*.html` (page logic + markup)

### Module Pattern
```javascript
// Singleton manager pattern
export const MyManager = {
  _state: null,
  
  init() {
    this._state = {};
  },
  
  async doSomething() {
    // Implementation
  }
};

// Class-based pattern
export class MyService {
  constructor(deps) {
    this.deps = deps;
  }
  
  async method() {
    // Implementation
  }
}
```

### IPC Safety Rules
- **Never** use `remote` module (deprecated and unsafe)
- **Always** use `ipcRenderer.invoke()` for async operations
- **Always** validate input in main process handlers
- **Never** pass DOM objects through IPC
- **Always** sanitize file paths before operations

### Webview Best Practices
- **Lazy Loading:** Only create webviews when needed
- **Memory Management:** Destroy inactive webviews if memory constrained
- **Preload Scripts:** Use `webview-preload.cjs` for provider DOM manipulation
- **Security:** Never disable webSecurity in production
- **Communication:** Use `sendToHost()` from webview preload to renderer

### Plugin Development
See `plugins/hayalet-ev/README.md` for detailed guide:
- Create `.claude-plugin/plugin.json` manifest
- Add commands as Markdown files in `commands/`
- Use YAML frontmatter for metadata
- Test with `/plugin-name:command-name` syntax

---

## 🚀 Common Tasks

### Running the Application
```bash
# Install dependencies
npm install

# Development mode (Vite dev server + Electron)
npm run start
# or
npm run electron:dev

# Production build
npm run build
npm run electron

# Linting
npm run lint
npm run lint:fix

# Type checking
npm run check-types
```

### Adding a New AI Provider
1. **Create provider files:**
   ```bash
   mkdir -p src/js/modules/webview/providers/newprovider
   touch src/js/modules/webview/providers/newprovider/{config.js,index.js,scraper.js}
   ```

2. **Implement config.js:**
   ```javascript
   export const config = {
     id: "newprovider",
     name: "NewProvider",
     url: "https://newprovider.ai",
     domain: "newprovider.ai",
     // Add selectors, methods, etc.
   };
   ```

3. **Register in provider-registry.js:**
   ```javascript
   import { config as newprovider } from "./providers/newprovider/config.js";
   
   const providers = {
     chatgpt,
     grok,
     gemini,
     newprovider,  // Add here
   };
   ```

4. **Test:** Use MCP server tool or manual testing

### Debugging
- **Main Process:** Console output in terminal (where `npm start` runs)
- **Renderer Process:** DevTools in Electron window (Ctrl+Shift+I)
- **Webview:** Right-click webview → Inspect Element
- **IPC Issues:** Add `console.log` in preload.cjs and main.js handlers
- **Logs:** Check `~/.config/hayalet-ev/logs/`

### Testing with MCP Server
```bash
# Start MCP server separately for debugging
cd mcp-server
node index.js

# Use Rovodev to test tools
acli rovodev
# Then: "Hayalet-ev'de provider'ları listele"
```

---

## 🔌 Plugin System

### Available Plugins
- **hayalet-ev:** Project-specific commands (`add-webview`, `create-plugin`, `test-electron`)
- **git:** Git workflow automation (`commit-push`, `create-pr`, `review-pr`)
- **claude:** Meta-development commands (`create-command`, `create-skill`, `create-subagent`)

### Plugin Commands
Invoke with `/plugin-name:command-name` syntax in Claude Code:
```
/hayalet-ev:add-webview perplexity
/hayalet-ev:test-electron
/git:commit-push
/claude:create-command
```

### Plugin Structure
```
plugins/my-plugin/
├── .claude-plugin/
│   └── plugin.json          # Manifest (name, version, description)
├── commands/
│   ├── my-command.md        # Command definition with YAML frontmatter
│   └── another-command.md
└── README.md                # Documentation
```

---

## 🎨 UI Design Philosophy

### ULTRATHINK Protocol
See `ultrathink.md` for full behavioral protocols. Key points:
- **Default Mode:** Concise, focused, zero fluff
- **ULTRATHINK Mode:** Deep multi-dimensional analysis (trigger with "ULTRATHINK" command)
- **Design:** Intentional minimalism, anti-generic layouts
- **UI Library:** If a library exists in project, MUST use it (currently: none, vanilla JS)

### CSS Structure
- **Global:** `src/styles/main.css`
- **Page-Specific:** `src/styles/{page}.css`
- **Design:** Minimalist, functional, high contrast
- **Typography:** System fonts, clear hierarchy
- **Colors:** Dark theme primary (background: dark gray, text: white/light)

### UI Conventions
- **No Bootstrap/Tailwind:** Custom CSS only
- **Semantic HTML:** Use proper HTML5 elements
- **Accessibility:** WCAG AAA compliance where possible
- **Micro-interactions:** Subtle hover effects, transitions
- **Performance:** Minimize repaints, use CSS transforms

---

## 📁 Important Files Reference

### Core Entry Points
- `electron/main.js` - Application lifecycle, IPC handlers setup
- `src/index.html` - Main UI structure
- `src/js/app.js` - Renderer entry point
- `package.json` - Dependencies, scripts, metadata

### Configuration
- `jsconfig.json` - JavaScript project config (for IDE/type checking)
- `eslint.config.cjs` - ESLint rules (CommonJS config)
- `vite.config.js` - Vite build configuration
- `.gitignore` - Git exclusions

### Documentation
- `README.md` - Project overview (Turkish)
- `ultrathink.md` - AI behavioral protocols
- `AGENTS.md` - This file (development guide)
- `CLAUDE.md` - Claude Code specific guidance (to be migrated)

### MCP Server
- `mcp-server/index.js` - MCP protocol implementation
- `mcp-server/README.md` - MCP server documentation (Turkish)

---

## 🔒 Security Considerations

### Electron Security
- ✅ `contextIsolation: true` - Isolates preload from renderer
- ✅ `nodeIntegration: false` - No Node.js in renderer
- ✅ `sandbox: true` - Process sandboxing enabled
- ✅ `webSecurity: true` - CORS and web security enabled
- ✅ CSP headers - Content Security Policy enforced

### IPC Security
- All IPC channels validated in main process
- File paths sanitized before filesystem operations
- No dynamic `eval()` or `Function()` construction
- User input escaped before DOM injection

### Webview Security
- Each AI provider runs in isolated webview context
- Separate preload script with limited API exposure
- No direct DOM access from main/renderer to webview
- Communication via IPC and `sendToHost()` only

### Google Drive
- OAuth 2.0 flow with refresh tokens
- Credentials stored in secure system directory
- Token refresh handled automatically
- Disconnect option available

---

## 🛠️ Troubleshooting

### Common Issues

**Electron won't start:**
```bash
# Check Node.js version (18+ required)
node --version

# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Try with clean profile
npm run electron -- --user-data-dir=/tmp/hayalet-test
```

**IPC channel not working:**
- Check channel name matches in preload.cjs and main.js
- Verify `ipcMain.handle()` is registered before window creation
- Check for typos in `electronAPI` method names
- Look for errors in main process console output

**Webview not loading:**
- Check network connectivity
- Verify provider URL in config.js
- Inspect webview DevTools for errors
- Check if provider changed their DOM structure

**Settings not persisting:**
- Check file permissions on `~/.config/hayalet-ev/`
- Verify JSON syntax in settings.json
- Look for errors in settings-manager.js logs

**MCP Server not responding:**
```bash
# Test server directly
cd mcp-server
node index.js
# Should show "Hayalet-ev MCP Server started"

# Check Rovodev config
cat ~/.rovodev/mcp.json
# Verify path is correct

# Restart Rovodev
pkill -f "acli rovodev" && acli rovodev
```

---

## 📚 Learning Resources

### Electron Documentation
- [Electron Docs](https://www.electronjs.org/docs/latest/) - Official documentation
- [Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security) - Must-read
- [IPC Communication](https://www.electronjs.org/docs/latest/tutorial/ipc) - Inter-process communication

### Project Patterns
- Study existing providers in `src/js/modules/webview/providers/` for patterns
- Read `core-engine.js` to understand application flow
- Check `command-manager.js` for queue system implementation
- Review `protocol-handler.js` for AI-AI communication logic

### AI-Assisted Development
- Use ULTRATHINK mode for complex architectural decisions
- Leverage MCP server for automated tasks
- Use plugin commands for common workflows
- Follow patterns in existing code before creating new ones

---

## 🤝 Contributing Guidelines

### Before Starting
1. Read this AGENTS.md file completely
2. Review `ultrathink.md` for behavioral protocols
3. Check existing issues/features in progress
4. Discuss major changes before implementation

### Development Workflow
```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes following guidelines
# 3. Test thoroughly
npm run lint
npm run check-types
npm run start  # Test in dev mode

# 4. Commit with descriptive message (Turkish)
git add .
git commit -m "feat: Yeni özellik açıklaması"

# 5. Push and create PR
git push origin feature/my-feature
```

### Code Review Checklist
- [ ] Follows project code style
- [ ] No console.log statements (use LogManager)
- [ ] Error handling implemented
- [ ] Comments in Turkish for complex logic
- [ ] No new dependencies without discussion
- [ ] Tested in development mode
- [ ] No breaking changes to existing APIs
- [ ] Documentation updated if needed

### Commit Message Format
Use conventional commits (Turkish):
- `feat:` - Yeni özellik
- `fix:` - Hata düzeltmesi
- `docs:` - Dokümantasyon
- `style:` - Kod formatı
- `refactor:` - Kod iyileştirme
- `test:` - Test ekleme
- `chore:` - Bakım işleri

---

## 📝 Notes

### Language Convention
- **Code:** English (variables, functions, classes)
- **Comments:** Turkish (inline explanations)
- **Documentation:** Turkish (README, this file, other .md files)
- **Commit Messages:** Turkish
- **UI Text:** Turkish

### Performance Considerations
- Webviews are heavy - lazy load when possible
- Use `visibility: hidden` instead of destroying webviews for faster switching
- Debounce expensive operations (DOM scraping, archive writes)
- Monitor memory usage with large conversations

### Future Considerations
- **Plugin System V2:** Hot reload, better isolation
- **Cloud Sync:** Beyond Google Drive (Dropbox, OneDrive)
- **Mobile App:** React Native port?
- **AI Providers:** DeepSeek, Perplexity, Claude Desktop integration
- **Protocol V2:** More sophisticated AI-AI communication

---

## 🔗 Quick Links

- **Repository:** (Add your git repo URL)
- **Issues:** (Add issues URL)
- **Discussions:** (Add discussions URL)
- **MCP Server Docs:** `mcp-server/README.md`
- **Plugin Docs:** `plugins/hayalet-ev/README.md`
- **ULTRATHINK Protocol:** `ultrathink.md`

---

**Last Updated:** 2026-01-03  
**Version:** 5.2.0  
**Maintainer:** Raistlin Majere, Nexa, Gök
