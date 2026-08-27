# Spine MCP Server — User Manual

Version: 1.0.0 | Spine 3.8.75 | Last updated: 2026-08

---

## 1. Introduction

Spine MCP Server wraps **Spine 3.8.75 Professional** editor capabilities into **70 MCP tools**, enabling AI clients (Trae, Cursor, Claude Desktop, etc.) to directly:

- Read and parse Spine project structures
- Modify animation keyframes and curves
- Edit skeletons, slots, attachments, and skins
- Create and manage IK / transform / path constraints
- Edit meshes (including FFD deformation keyframes)
- Split atlases, auto-rig, and repack atlases
- Render animation preview frames

All modification operations use a **Round-Trip** mechanism (export JSON → modify → in-place import) and **automatically back up** the project before modification, ensuring rollback capability.

## 2. System Requirements

| Component | Requirement |
|---|---|
| OS | Windows 10/11 (tested) |
| Node.js | ≥ 20 (recommended 22 LTS) |
| Spine | **3.8.75 Professional** (`Spine.com` CLI) |
| Optional | Cocos Creator 3.8+ (extension panel) |

> This service is optimized for Spine 3.8.75. When opening projects from other versions, a compatibility warning will be shown, but operations are not blocked.

## 3. Installation

### 3.1 Install Node.js

Download and install the LTS version from [nodejs.org](https://nodejs.org). Verify in your terminal:

```bash
node -v   # Should show v20 or higher
```

### 3.2 Prepare Spine

Ensure Spine 3.8.75 Professional is installed. Note the path to `Spine.com`, for example:
`D:\cocos\SpinePro3.8.75\Spine.com`

### 3.3 Install Dependencies and Build

```bash
cd D:\cocos\spine-mcp-server
npm install
npm run build
```

### 3.4 Configure Environment (choose one)

**Option A: Installer Wizard (recommended)**

```bash
npm run installer
```

Automatically detects Node / Spine / Cocos environments and writes `.env`.

**Option B: Manual `.env` Setup**

```
SPINE_EXE=D:/cocos/SpinePro3.8.75/Spine.com
LOG_LEVEL=info
```

## 4. Quick Start (3 Steps)

1. **Verify**: `node dist/index.js check` → Shows "Spine CLI verification passed"
2. **Configure AI Client**: Copy the MCP config to Trae / Cursor / Claude Desktop
3. **Start Chatting**: Ask AI to read/modify your Spine projects

## 5. AI Client Configuration

### 5.1 Trae / Cursor / Claude Desktop

Add the following to your client's MCP server configuration:

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

After configuration, restart the client. You should see 70 `spine_*` tools available.

> **Troubleshooting**: If "No tools yet" appears, the server stdout may be polluted or the process hasn't restarted. **Delete the config → Restart the client → Re-add the config**.

### 5.2 Verify Connection

Try asking your AI:
> "Show me the project info for D:/cocos/SpinePro3.8.75/examples/hero/hero-pro.spine"

The AI will call `spine_get_project_info` and return structured data about bones, slots, skins, and animations.

## 6. CLI Commands

| Command | Purpose |
|---|---|
| `node dist/index.js check` | Verify Spine CLI and configuration |
| `node dist/index.js info <path>` | Display project information |
| `node dist/index.js version <path>` | Detect project version (3.8.55/3.8.75...) |
| `node dist/index.js export <path> <out> json\|binary` | Export JSON/binary |
| `node dist/index.js reader <json>` | Parse exported JSON |
| `node dist/index.js mcp` | Start MCP server (for AI client connections) |

## 7. Tool Reference (70 Tools)

### 7.1 Information Queries (8 tools)

| Tool | Description | Key Parameters |
|---|---|---|
| `spine_get_project_info` | Project structure overview (bones/slots/skins/anims) | projectPath |
| `spine_inspect_json` | View raw JSON snippets | projectPath, path |
| `spine_list_animations` | List animations with durations | projectPath |
| `spine_list_events` | List event definitions | projectPath |
| `spine_list_constraints` | List all constraints (IK/transform/path) | projectPath |
| `spine_get_attachments` | List available attachments for a slot | projectPath, slotName |
| `spine_get_animation_detail` | Animation timeline structure | projectPath, animationName |
| `spine_render_preview` | Render animation frame as PNG via JS | skeletonJson/atlas/image + animationName |

### 7.2 Skeleton Structure (9 tools)

| Tool | Description |
|---|---|
| `spine_control_bone` | Write bone keyframes (rotate/translate/scale/shear) |
| `spine_add_bone` / `spine_delete_bone` | Add/delete bones (delete auto-reorders weight mesh indices) |
| `spine_set_bone` | Bone setup pose properties |
| `spine_add_slot` / `spine_delete_slot` / `spine_set_slot` | Slot add/delete and setup |
| `spine_rename_slot` | Rename slot (syncs skins/deform) |
| `spine_batch_rename` | Batch rename bones/slots |

### 7.3 Attachments & Skins (6 tools)

| Tool | Description |
|---|---|
| `spine_set_attachment` | Outfit swap (set slot default attachment) |
| `spine_add_attachment` / `spine_delete_attachment` | Add/delete attachments (region needs width/height) |
| `spine_set_attachment_transform` | Attachment position/rotation/scale/color |
| `spine_edit_mesh` | Mesh setup vertices + deform FFD keyframes |
| `spine_set_skin` | Skin management |

### 7.4 Constraints (9 tools)

IK / Transform / Path constraints each have 3 tools: `spine_add_*`, `spine_set_*` (setup or animation mode), `spine_delete_*`.

> ⚠️ Constraint `order` must be unique across all types; tools handle this automatically.

### 7.5 Animation (11 tools)

`spine_add_simple_animation` (simple animation generation), duplicate/delete/rename animation, `spine_set_animation_settings` (duration/scale), `spine_control_slot` (slot timeline), `spine_control_constraint` (constraint timeline), `spine_add_event_keyframe` (events), `spine_set_draw_order` (draw order), `spine_set_curve` (curves), `spine_export_video` (placeholder).

### 7.6 Atlas & Project (9 tools)

| Tool | Description |
|---|---|
| `spine_split_atlas` | Split atlas by region/connected components |
| `spine_repack_atlas` | Repack parts into .atlas + png |
| `spine_import_image` | Point attachment texture (region name or absolute path) |
| `spine_export` / `spine_import` / `spine_clean` | Export / Import / Clean |
| `spine_create_project` | Create empty project |
| `spine_scale_project` | Global scale |
| `spine_rollback` | List backups and rollback |

### 7.7 Cocos Toolchain (5 tools)

`spine_list_cocos_assets` (scan workspace), `spine_validate_references` (reference integrity), `spine_build_skeleton` (auto-rigging), `spine_cut_parts` (scattered-part cutting), `spine_assemble` (AI assembly rigging).

## 8. Walkthrough: Reading Project Info

Example conversation:
> "Show me the structure of D:/cocos/SpinePro3.8.75/examples/goblins/goblins-pro.spine"

The AI calls `spine_get_project_info` and returns structured data including bone tree, slots, skins, and animations.

## 9. Walkthrough: Modifying Animation Keyframes

1. Copy the project to a test location (to avoid modifying the original)
2. Ask: > "Change the root bone rotation of the walk animation in the goblins copy to 15 degrees at frame 0"
3. The AI calls `spine_control_bone`, which automatically backs up the original file
4. Verify: Re-export to check `angle=15`; or reopen the file in Spine Editor

> ⚠️ After modification, if the Spine Editor is already open, use **File → Reopen** to load the latest file. Saving in the editor will overwrite AI modifications.

## 10. Walkthrough: Outfit Swapping / Skins

1. `spine_get_attachments` to view available attachments
2. `spine_set_attachment` to switch a slot's attachment (e.g., head → hat)
3. Or `spine_set_skin` to switch the entire skin set

## 11. Walkthrough: Constraints (IK / Transform / Path)

1. `spine_add_ik` to create an IK constraint (bones + target)
2. `spine_set_ik` in setup mode to change mix; animation mode to write keyframes
3. `spine_control_constraint` to write mix values directly at specific frames

## 12. Walkthrough: Atlas Splitting (Character → Parts)

1. Prepare atlas: `examples/goblins/export/goblins.atlas` + `goblins.png`
2. `spine_split_atlas` mode=region extracts by area; mode=split performs connected-component splitting (separates touching parts)
3. Get individual part PNGs for subsequent rigging/outfit swapping

## 13. Walkthrough: Auto-Rigging

1. Use the split parts directory, optionally configure `partsIndex.json` to specify bone/position for each part
2. `spine_build_skeleton` generates skeleton JSON (grid/list layout)
3. `importToProject` can directly import to create a `.spine` project

## 14. Walkthrough: Render Preview

1. The project must have exported atlas (`xxx.atlas` + `xxx.png`)
2. `spine_render_preview` with skeleton JSON / atlas / png / animation / time
3. Outputs a PNG; AI can use this to confirm animation effects (mesh attachments are approximated)

## 15. Cocos Creator Extension

Install the `cocos-extension` (local extension or `.ccx`). The panel provides: service start/stop, project scanning, AI config generation, and service status. See `docs/cocos-extension-README.en.md` for details.

## 16. Backup & Rollback

- Each modification automatically generates `xxx.spine.YYYY-MM-DDTHH-MM-SS.bak`
- `spine_rollback` lists backups; the `rollback` parameter can restore a specific backup
- It is recommended to copy the project before making modifications

## 17. Version Compatibility

- Target: Spine 3.8.75
- 3.8.55 and older: Best-effort compatibility + WARNING message
- 4.x: JSON format differs significantly, may fail. Recommend downgrading to 3.8.75

## 18. FAQ

**Q1: MCP shows "No tools yet"?**
A: Delete the config → Restart the client → Re-add the config. If it still fails, check if `node dist/index.js mcp` runs standalone in the terminal.

**Q2: Changes not visible in Spine?**
A: Use File → Reopen in the editor to reload. Also ensure you're viewing animation mode, not Setup mode.

**Q3: Bone deletion fails (weighted mesh attached)?**
A: Version 3.8 supports auto-reordering. If it still errors, check if the bone is referenced by a constraint.

**Q4: Atlas split parts are incomplete?**
A: Use mode=split to separate touching parts. Adjust alphaThreshold/minSize.

**Q5: Render preview is blank?**
A: Ensure the atlas has been exported and the atlas/png matches the project (by name or subdirectory).

## 19. Safety & Notes

- This service runs **locally** on your machine. Tools can read and write local .spine files. Do not expose it to untrusted environments.
- Modification operations automatically create backups, but version control (Git) is still recommended for important projects.
- When the Spine Editor and MCP are open on the same project simultaneously, avoid saving from both sides at the same time.

## 20. Upgrades & Maintenance

- Rebuild after each change: `npm run build` before reconnecting to the client
- After updating, refresh the MCP connection in your AI client; restarting the process applies changes
- Tests: `npm run test:all`