# Spine MCP Server — Cocos Creator Extension

Cocos Creator 3.8+ visual panel: one-click MCP service start, Spine project scanning, tool invocation, and AI client config generation.

## Installation (Two Methods)

### Method A: Local Extension (recommended for development/testing)

1. Open Cocos Creator → Menu **Extension → Extension Manager → Local Extension**
2. Click **Add Local Extension**, select the `cocos-extension` directory
3. Find **Spine MCP Server** in the extension list, enable it
4. Menu **Extension → Spine MCP Server** opens the panel

### Method B: .ccx Package

1. Run `node scripts/package-ccx.js` to generate `dist-ccx/spine-mcp-panel.ccx`
2. In Cocos Extension Manager, click **Import .ccx** to install

## Usage

1. **Configure Spine Path**: Enter the `Spine.com` path in the panel's "Basic Config" section (e.g., `D:/cocos/SpinePro3.8.75/Spine.com`), click Save
2. **Configure Workspace**: Enter the directory containing .spine files (e.g., your Cocos project's `assets` folder)
3. **Start Service**: Click "Start Service", the status indicator turns green
4. **Copy AI Config**: Click "Generate Config" → "Copy", then paste into Trae / Cursor's MCP configuration
5. **Scan Projects**: The project list shows .spine files in the workspace; click to view info and invoke quick tools

## Requirements

- Cocos Creator 3.8+
- Spine.com (Professional edition) installed
- Server must have been built: `npm run build` (the installer wizard handles this automatically)
- Server path can be configured in the panel's "Server Path" field (default: `D:/cocos/spine-mcp-server`)

## Environment Detection & Installer Wizard

Run `node scripts/installer.js` to automatically detect Spine/Cocos/Node, write `.env`, install dependencies, and build the server.