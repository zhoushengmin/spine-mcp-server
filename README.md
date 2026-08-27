# 🦴 Spine MCP Server

> AI-driven Spine 3.8.75 animation workflow server — lets AI clients (Trae / Cursor / Claude Desktop) directly control Spine.

[![Node](https://img.shields.io/badge/Node-%3E%3D20-339933)](https://nodejs.org) [![Spine](https://img.shields.io/badge/Spine-3.8.75-yellow)](https://esotericsoftware.com) [![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

## 📖 Overview

**Spine MCP Server** is a server built on the [MCP (Model Context Protocol)](https://modelcontextprotocol.io) that wraps **Spine 3.8.75 Professional** editor capabilities into **55 MCP tools**, allowing AI clients to directly:

- Read Spine projects (bones, slots, skins, animations, events, constraints)
- Modify animation keyframes (rotation, translation, scale, shear, curves)
- Edit skeleton structure (add/delete bones, slots, attachments, skins, outfit swapping)
- Manipulate constraints (IK, transform, path) and meshes (FFD deformation)
- Split atlases (extract parts from character illustrations), auto-rig, repack atlases
- Render animation preview frames via JS runtime
- One-click configuration, start/stop service, and generate AI client configs via Cocos Creator extension panel

## ✨ Features

| Capability | Description |
|---|---|
| 55 MCP Tools | Covers all Spine domains (info, skeleton, attachments, constraints, animation, atlas, project) |
| Round-Trip Modification | Export JSON → Modify → In-place import, **automatic backup** (`.bak`) |
| Version Compatibility | Locked to Spine 3.8.75, friendly warnings for other versions |
| Cocos Extension | Cocos Creator 3.8+ visual panel + `.ccx` packaging |
| Installer Wizard | One-click environment detection + config writing |

## 🔧 Requirements

- **Node.js ≥ 20** (tested on v22)
- **Spine.com** (3.8.75 Professional, e.g. `D:\cocos\SpinePro3.8.75\Spine.com`)
- Optional: Cocos Creator 3.8+ (for extension panel)

## 🚀 Quick Start

```bash
# 1. Install dependencies + build
npm install
npm run build

# 2. Configure Spine path (or run the installer wizard)
npm run installer        # Auto-detect Spine/Cocos/Node and write .env

# 3. Verify
node dist/index.js check
node dist/index.js info "D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine"
```

## 🤖 MCP Config

Add the following configuration to your Trae / Cursor / Claude Desktop MCP server settings:

```json
{
  "mcpServers": {
    "spine-mcp": {
      "command": "node",
      "args": ["D:/cocos/spine-mcp-server/dist/index.js", "mcp"],
      "env": { "SPINE_EXE": "D:/cocos/SpinePro3.8.75/Spine.com" }
    }
  }
}
```

> ⚠️ If MCP shows "No tools yet", restart your AI client to allow the server process to reload.

## 🧩 Tools (55)

| Category | Tools |
|---|---|
| Information (8) | get_project_info · inspect_json · list_animations · list_events · list_constraints · get_attachments · get_animation_detail · render_preview |
| Skeleton Structure (9) | control_bone · add_bone · delete_bone · set_bone · add_slot · delete_slot · set_slot · rename_slot · batch_rename |
| Attachments & Skins (6) | set_attachment · add_attachment · delete_attachment · set_attachment_transform · edit_mesh · set_skin |
| Constraints (9) | add/set/delete × {ik, transform, path} |
| Animation (11) | add_simple_animation · duplicate/delete/rename_animation · set_animation_settings · control_slot · control_constraint · add_event_keyframe · set_draw_order · set_curve · export_video |
| Atlas & Project (9) | split_atlas · repack_atlas · import_image · export · import · clean · create_project · scale_project · rollback |
| Cocos Toolchain (3) | list_cocos_assets · validate_references · build_skeleton |

## 🎮 Cocos Extension

The `cocos-extension/` directory provides a Cocos Creator 3.8+ panel:

- **Installation**: Extension Manager → Local Extension → Add `cocos-extension` directory (or run `npm run package:ccx` to generate a `.ccx` file for import)
- **Features**: Start/stop MCP service, scan projects, generate AI config, service status
- See [docs/cocos-extension-README.en.md](docs/cocos-extension-README.en.md) for details

## 🧪 Tests

```bash
npm run test:all     # Run all test suites (unit + integration + MCP protocol + extension bridge)
npm run test:unit    # Unit tests only (node:test)
```

Test matrix: Unit **20/20** · Phase 3 **37/37** · Phase 4 **45/45** · Phase 5 **13/13** · MCP Protocol **10/10** (55 tools) · Extension Bridge **12/12**

## 📚 Docs

- [User Manual (EN)](docs/USER_MANUAL.en.md)
- [User Manual (中文)](docs/USER_MANUAL.md)
- [Cocos Extension README (EN)](docs/cocos-extension-README.en.md)
- [Cocos Extension README (中文)](docs/cocos-extension-README.md)


## 🗂 Project Structure

```
├── src/                  # Source code (TypeScript)
│   ├── server.ts         # MCP stdio server
│   ├── spine/            # Core: cli-executor / json-handler / export / import / render / split ...
│   ├── tools/            # 55 tools (registered in registry.ts)
│   └── utils/            # Config / logger / error codes / file utilities
├── cocos-extension/      # Cocos Creator extension (panel)
├── scripts/              # Installer wizard / .ccx packaging
├── tests/                # All test suites
└── docs/                 # Specs, manuals, progress
```

## 💰 Support

Available on the [Swarms Marketplace](https://swarms.world/mcp/spine-mcp-server)

## 📄 License

MIT