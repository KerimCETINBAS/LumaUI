# LumaUI.ActionBars

Optional action-bar collection starter and native bar controls for LumaUI.

On the first migration, learned spells are arranged into the existing rows and saved as the `action-bars` preset collection, including previous position and key bindings. Rendering, drag handles and hover binding then use the master's collection runtime. Later startups retain the saved layout. New learned spells are not automatically appended to edited collections.

Open **Action Bars > Edit collection**, or choose it in **UI Library**. `/luma unlock` moves collections; `/luma bind` edits their secure-button bindings. **Restore starter collection** explicitly recreates the initial rows from the current spellbook.

The collection is owned by `LumaUI_ActionBars`, so disabling this addon also prevents its collection from mounting on the next reload. The master retains the original native action-bar backup. `/lumaclearbars` and `/lumarestorebars` remain explicit actions; no automatic slot clearing occurs.

Development is managed from the monorepo root: `npm ci`, `npm run check`, `npm run build`, and `npm run test:integration`. Run `npm run deploy` to install all addons into the configured local game directory. The shared `lumaui/core` contract is linked directly through npm workspaces; its TOC requires LumaUI.
