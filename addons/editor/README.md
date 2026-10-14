# LumaUI.Editor

Optional visual collection editor for LumaUI, built with wuira.

Open **UI Library > Edit** to change a saved player or hotbar collection, or use **New** in the editor to start another collection. Add and nest elements, change their dimensions, bind HP/mana to progress bars, or bind a spell ID to an action button. Action previews do not execute spells.

The preview uses the same component factories and layout engine as the mounted collection. It centers the collection at its actual size, without scaling or applying its screen position. Inactive timers, absent icons and empty dynamic labels get sample visuals for editing. This does not change runtime visibility or saved anchors. Selecting elements refreshes the page after the click finishes while keeping the window open.

**Properties** follows a grouped form layout: **Display**, **Layout**, **Data**, and **Actions** for action buttons. Related settings appear together, with labeled number inputs, dropdowns, checkboxes and RGBA swatches. Scroll to see longer forms, then **Save properties**. **Apply** updates the mounted collection.

**Sources** lists the collection’s sources. Create a named source, choose its registered type, edit its labeled fields together in the scrolling form, and **Save source**. Existing sources can be edited or deleted once their references are removed. In **Properties**, choose a **Source** from the dropdown and optionally enter a **Path** such as `channels.regen` or `progress`. Empty paths use the source’s default capability. The binding selector also exposes visibility, text and opacity links. Paths resolve bindable source objects; computation factories are a separate future feature.

**Save** persists the working draft. **Apply** saves and mounts its preset collection. **Import** opens a shared collection in the draft; **Export** produces one LumaUI share string. Native Blizzard skins use the separate entry in the master's UI Library.

The editor preserves source/activity/text/alpha links and optional-addon ownership when opening existing collections. Closing the editor does not remove mounted collections. The hierarchy is one scrollable tree. Drag a row to another row’s top/bottom edge to reorder it, or to the middle to nest it. The highlighted area and hint show the destination. Root moves, ancestor cycles and invalid child counts are rejected. **Move up / Move down** are also available.

Development is managed from the monorepo root: `npm ci`, `npm run check`, `npm run build`, and `npm run test:integration`. Run `npm run deploy` to install all addons into the configured local game directory. The shared `lumaui/core` contract is linked directly through npm workspaces; its TOC requires LumaUI.
