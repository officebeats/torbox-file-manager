# 🤝 Contributing to TorBox File Manager

We love contributions! Whether you're a seasoned developer, a product peer, or a junior engineer, your help is welcome to make TorBox File Manager even better.

---

## 🛠️ Development Setup

### Prerequisites
* [Node.js](https://nodejs.org) (v18 or higher recommended)
* npm (comes bundled with Node)

### Step 1: Clone the Repository
```bash
git clone https://github.com/officebeats/torbox-file-manager.git
cd torbox-file-manager
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Run Development Server (Vite)
```bash
npm run dev
```

### Step 4: Build for Production
To bundle and compile the extension (which generates the output files under `dist/`):
```bash
npm run build
```

---

## 🔌 Running the Unpacked Extension in Chrome/Opera

To test your local changes in real-time inside your browser:
1. Run `npm run build` (or keep Vite watch running).
2. Open your browser's extensions page:
   * **Chrome**: `chrome://extensions`
   * **Opera/Opera GX**: `opera://extensions`
3. Toggle the **Developer mode** switch in the top right corner.
4. Click the **Load unpacked** button.
5. Select the `dist/` folder in the root of this project.
6. The extension is now loaded! Pin it and click the icon to launch the file manager tab.

---

## 📁 Codebase Architecture

Here is a quick overview of the code organization to help you find your way around:
* **`manifest.json`**: Standard Chrome extension configuration. Declares permissions, background workers, and dashboard content script injections.
* **`src/App.jsx`**: The main React interface, layouts, drag-and-drop handlers, tags panel, and file explorer.
* **`src/useVFS.js`**: Custom React hook implementing the Virtual File System (VFS) logic, folder hierarchies, circular dependency checks, and browser profile sync (`chrome.storage.sync`).
* **`src/api.js`**: Services calling the official TorBox API.
* **`src/utils.js`**: Shared logic, byte formatters, and file type classification heuristics (e.g. video formats, anime, games, books).
* **`src/background.js`**: Background service worker handling message actions (like dashboard redirects).
* **`src/content.js`**: Content script running on `torbox.app` to inject the floating manager shortcut.

---

## 🚀 Submission Guidelines
1. Fork the repo and create your feature branch: `git checkout -b feature/amazing-feature`.
2. Commit your changes: `git commit -m 'feat: Add amazing feature'`.
3. Push to the branch: `git push origin feature/amazing-feature`.
4. Open a **Pull Request** against `master`.

Let's build something awesome together! 🌟
