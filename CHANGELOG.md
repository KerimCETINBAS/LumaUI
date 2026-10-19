# Changelog

All notable changes to the LumaUI addon suite are recorded here. Core and Editor share one release version.

## [Unreleased]

## [0.2.4] - 2026-10-19

### Changed

- Addon sources live under `packages/core` and `packages/editor`. Datasource factories open Wuira sources with `UseSource`.

### Added

- Empty `luma.web` shell, built with `npm run build -- --web`.
- Source ownership note: a source has one owner, and a lower layer must not dispose a source it received.

## [0.2.3] - 2026-10-18

### Added

- Named, typed component source inputs for UnitSource, resources, lists and converter outputs, with capability-based compatibility, required/optional inputs and dropdown connections in Inspector > Data.
- Source rename with explicit reference-update choices, scoped local rewrites, saved caller input updates, draft persistence and Undo/Redo.
- Unit text paths for Name, Surname and FullName. FullName joins a player's forename and surname; NPCs keep Surname and FullName empty. Leader text and an IsLeader boolean are available on the same unit.
- Visibility accepts any boolean source, with its own path and a show-when-true or show-when-false choice.
- Icon glow accessory drawn by ForeverAuras LibCustomGlow: pixel, button overlay, autocast shine and proc.

### Changed

- Repeat no longer generates a named `items` source. Its child has an explicit Item input; current-item connections work for all lists, and Data accepts typed `parent.$item` or visible `RepeatName.$item` expressions alongside dropdown choices.
- Preserve item source identity through component layers, notify consumers on keyed row updates, and remove only legacy empty list placeholders used exclusively by Repeat.
- New editor drafts start with an empty hierarchy. The first chosen element becomes the root; empty drafts persist and first-element/root removal supports Undo/Redo.
- Repeat uses component reference slots with separate instance scopes. Current-member data passes through named inputs using parent.$unit; spell item sources use parent.$item. Legacy inline templates migrate without dropping member/pet content.
- Borrowed sources retain owner identity and cleanup; child subscriptions and derived sources remain local. Invalid contexts report errors instead of silently using player data.
- Common dropdown labels use a separate themed chevron, preserving clipping and scrolling for narrow inspectors.
- Flow and grid layouts choose arrange direction separately from horizontal and vertical placement. A child's anchor places it inside the space reserved for it. Older horizontal, vertical and justify settings still load.

### Fixed

- Invalid typed component connections restore the previous accepted field and show actionable type/context errors, so selection, Undo and retries are no longer trapped by rejected form text.
- Missing required inputs in repeated children render a normalized empty preview cell instead of failing in the layout engine.
- Unchanged custom texture input notifications no longer erase an icon selected from the catalog when saving.
- Secure Button Actions inspector opens correctly inside the content-sized section cards, including the Click Cast preset selector.

## [0.2.2] - 2026-10-17

### Added

- Bordered, padded cards for Properties sections and individual Sources, with clearer spacing and wrapped explanatory notes.
- Hierarchy element names can be edited from a row double-click or the inspector, persist in component exports and support Undo without changing IDs or bindings.

### Fixed

- Invalid typed component connections restore the previous accepted field and show actionable type/context errors, so selection, Undo and retries are no longer trapped by rejected form text.
- Missing required inputs in repeated children render a normalized empty preview cell instead of failing in the layout engine.
- New editor components start with a Cell instead of a mandatory headless group. Root type is editable; removing a headless root preserves its children and supports Undo.

## [0.2.0] - 2026-10-17

### Fixed

- Invalid typed component connections restore the previous accepted field and show actionable type/context errors, so selection, Undo and retries are no longer trapped by rejected form text.
- Missing required inputs in repeated children render a normalized empty preview cell instead of failing in the layout engine.
- Target UnitSource emits identity invalidations on PLAYER_TARGET_CHANGED; dependent HP, text and unit displays refresh without invalidating unrelated unit sources or rewriting secure unit attributes.

- Library thumbnails use source-free static snapshots and guard secret measurements, avoiding live health/power conversions while preserving saved components.

### Added

- Compact read-only previews between UI Library card headings and actions, with No visual placeholders for headless components and native skins.

- Per-instance component activation overrides and empty typed source inputs exposed from Sources. Reference inspectors connect existing parent SourceInstances without constructing or owning a second datasource; unbound optional inputs omit dependent visuals.
- Name-derived identities for new/renamed components, optional Yes/No reference rewrites, numbered duplicate names and an optional import name field. Missing references remain editable; character keybindings move with the renamed component.

- Import copy creates a separate component with a unique ID, preserving existing components and reusing equivalent Click Cast presets.

- Built-in Player and Target unit-frame import strings cloned from the party member cell, with independent fixed-unit sources, identical styling/click presets and secure unit-watch visibility. No hardcoded component or automatic import.

- Opt-in read-only `/luma secureplates start|report|stop` client audit for combat-time
  nameplate creation and identity reuse. Secure nameplate actions remain unverified;
  the audit does not cast spells or modify native/secure frames.

- Dynamic `BlizzardElement` skin primitive and serializable `blizzardElement` factory
  with exclusive Apply/Replace operations, per-nameplate unit/source scopes and
  independently owned Wuira rules. Add checked `UnitToBool` helpers and editable
  `unitToBool` converter sources. The editor supports filter selection and mode changes;
  preview never registers native rules. Requires Wuira 0.2.7.
- Mock Lua integration and JSX type coverage for nameplate factories, unit filtering,
  recycling, subscription cleanup, rollback, secure-template rejection and editor Undo.

- Native action tooltips on saved/source-backed SecureButtons, enabled by default and configurable per button.
- Optional Paladin action-bar import string with its headless native-bar dependency; no runtime layout constructor or character bindings.

- Include the repository MIT license in every addon build and deployment; release validation verifies the shipped license.

- Shared unlock handles for visible native Edit Mode systems and common Blizzard frames, with scale-aware dragging, character/layout position storage, combat deferral and restoration on reset.

- Focus-to-capture Click Cast binding inputs with readable mouse labels, modifier capture, Escape cancellation and Delete/Backspace clearing.

- Per-binding Click Cast targeting modes: Direct secure action or guarded Mouseover macro, with independent Friendly/Enemy, Living only and Clear targeting controls. Existing preset-level target preferences migrate into binding rows and survive sharing.

- Scrollable source cards with separators, inline converter fields and atomic staging of multiple source forms.
- Appearance inputs choose static values or source/path bindings in place; visibility, text, icons and progress sources live beside their visual values.

- Shared Click Cast preset target traits: friendly/enemy unit restrictions and explicit clicked-unit spell/item targeting, preserved by import/export.
- Generic static list source with validated stable record keys for repeated templates.

- Automatic import validation with inline errors, a red invalid-input border and read-only previews for visual components. Transfer dialogs use an opaque background above the configuration window.
- Independent Click Cast preset inclusion switches for import and export; omitted custom bindings fall back to standard unit actions.

- Shared core Preview component for the editor and read-only import previews, with zoom, 1:1 and Fit controls that leave saved geometry untouched.
- Local panel expansion/restore controls and a central Preview/Component/Sources workspace, replacing the global focus row and inspector-level tabs.
- Bounded session undo/redo for component edits and deleted subtrees, with a live unsaved-changes indicator.

- Editable LumaUI case and math converter factories powered by wuira’s generic callback SourceConverter. Configure input sources, value paths, typed case outputs, defaults and arithmetic formulas in Sources.
- Generic property source bindings for background, border, progress color and opacity. Migrate retired class color flags into editable source data while preserving native secure button behavior.

- Searchable spell fields with real client names, ranks, icons and selected-item lists. Spell filters store IDs and return up to 48 matches per query.
- Separate icon selection from wuira’s generated client icon catalog, preserving custom texture paths and native FileDataIDs.
- Character action selection for SecureButtons from learned active spells, equipped on-use items and carried consumables. Search queries never become component data.

### Removed

- Separate Hide bars tool and factory; native action bars are a target of Hide frame. Existing bar effects migrate without changing node IDs or restoration ownership.

- Specialized party, raid, spell-list and headless creation entry points. The library exposes one New action beside Import; built-in examples remain available from Dashboard.

- Retire the LumaUI.ActionBars workspace, addon and character-specific Paladin layout generator. Core and Editor now build and ship as the complete suite; action buttons remain ordinary editable components.

### Fixed

- Invalid typed component connections restore the previous accepted field and show actionable type/context errors, so selection, Undo and retries are no longer trapped by rejected form text.
- Missing required inputs in repeated children render a normalized empty preview cell instead of failing in the layout engine.
- Replace the floating rectangular minimap launcher with a standard minimap-edge
  icon. Use LibDBIcon when present, with a circular draggable fallback, click-to-open
  behavior and persisted angular position. No other addon is required.

- Retain unfinished native text fields, rename input, selected panels, zoom and edit history across combat; reopen the editor afterward without applying the draft.
- Expose repeated lists and all registered visual elements in the editor. Allow adding and dragging into member templates and keep the selected component name visible.

- Keep character keybindings in a separate collection/node registry. Editor Apply, stale imports, reloads and reapplying components cannot restore embedded default keys. Migrate existing saved bindings once, including explicit unbinding.

### Changed

- Repeat no longer generates a named `items` source. Its child has an explicit Item input; current-item connections work for all lists, and Data accepts typed `parent.$item` or visible `RepeatName.$item` expressions alongside dropdown choices.
- Preserve item source identity through component layers, notify consumers on keyed row updates, and remove only legacy empty list placeholders used exclusively by Repeat.
- New editor drafts start with an empty hierarchy. The first chosen element becomes the root; empty drafts persist and first-element/root removal supports Undo/Redo.
- Remove role icons from party/raid starter headings. Offline members display an editable gray OFFLINE panel in place of resources, driven by a shared connection source and ordinary alpha converters; secure actions remain intact.

- Replace the party starter's left selection strip with a class-colored name heading that retains standard left/right-click actions. Existing saved components are unchanged; import the updated starter to use it.

- Keep manual native slot clear/restore commands in the core, reusing existing character backups. Capture slots only on an explicit first clear request, with reload required before clearing. Release retired ActionBars ownership on saved/imported components while retaining their trees, activation rules and bindings.

- Present LumaUI's features, installation and first-use flow in a player-facing README. Move build/release details to a development guide and track the remaining CurseForge presentation and client-validation work separately.

- Replace editor component dropdowns with a filterable ribbon and double-click name editing. Show matching reusable components within the available width, retain textbox focus while filtering, and preserve stable IDs when renaming.
- Add 44 original SVG glyphs for tools, hierarchy types and common controls. Build transparent native textures into the core addon and expose the shared icon catalog through theme tokens.

- Give the in-game editor the full configuration workspace with Back navigation, panel focus tabs, a categorized tool ribbon, readable collapsible hierarchy rows, direct preview selection, and native scrolling without paged dropdowns.
- Move component creation and import/export to UI Library. One editor Save commits pending properties and source edits, persists the component and updates the live UI; invalid edits leave saved data unchanged.

- Remove obsolete automatic player/group/action-bar preset seeders, reset regeneration, and shipped-template migrations. Reload and reopening the editor retain saved component geometry and styling; built-ins are installed only through explicit import. The obsolete ActionBars layout generator has been removed.

- Compact the party/raid member templates: transparent headings, health values without a percentage row, and 2-unit resource bars. Debuff compartments show thin borders only when their category is present, with hover fill; secure click targets remain stable during combat.

- Allow multiple mouse/spell bindings per Click Cast preset, with an add/remove row editor, canonical combination validation and automatic migration of existing single-binding presets. Updates apply to every attached secure button and removed mappings are cleaned up.

- Replace the shipped party/raid class outlines with editable, filled class-colored selection strips using standard left-target and right-menu clicks. Saved component edits remain untouched.

- Name reusable saved UI entries Components throughout the library, editor and import/export dialogs; reserve Collection for grouping components. Retain saved IDs and transfer compatibility.

- Compact UI Library into a scrollable two-column card grid with a single enable/disable toggle per item. Place highlighted Collections/Blizzard Skins tabs at the top and the active view's import action at the right.

- Remove the separate Action Bars settings tab; manage its collection through UI Library. Existing action-bar commands remain available and open the library.

- Scope native action-bar hiding to collection lifetime with shared ownership and combat-deferred restoration. Keep native event/script handlers intact for immediate reversal.
- Separate native slot backup/clear/restore commands from visibility; retain existing backups and require explicit commands for slot changes.

- Pin wuira 0.2.4 from npm, including keyed ForEach rendering, shared unit references, native Edit Mode layouts and tooltip attachments.

### Added

- Import copy creates a separate component with a unique ID, preserving existing components and reusing equivalent Click Cast presets.

- LumaUI KnownSpells helpers with exact names, glob selectors, bounded regex matching, cached iterable collections and event subscriptions.
- Generic ForEach item scopes and registered list expressions. Spell templates share an automatic current-item action/icon/cooldown source and retain native widgets by spell ID across learned-spell changes; combat changes wait.
- Editor Spell list drafts, helper-expression input, Known spells named sources and Current item binding choices. Expressions and templates round-trip as saved data.

- Blank party/raid list drafts with a roster source and one editable member template. Sources can use $unit and $pet; no per-member UI is hardcoded.

- Editable Paladin healer party and raid starter components: five-member columns, class borders, names, role/leader indicators, health/primary power, aura compartments, and separate party pets or inline raid pets.
- Source-driven keyed ForEach member templates with GUID identity, full-name/realm fallback, independent `$unit` / `$pet` references and native raid subgroup ordering. DC/online and slot reassignment retain cells and sources; only added/removed members allocate/dispose. Structural changes wait for combat to end.
- Manual Always activation bypasses automatic filters and shows the player while solo.
- Shared mouse Click Cast presets for heal, Purify and Freedom areas; native modified click attributes target each button's unit without global keyboard overrides. Multiple presets may use the same mouse combination.
- Event-driven unit text, primary resource, role/leader and bounded aura displays. Unreadable aura categories show `?`; slow/root detection uses an editable spell list.

- Optional keybinding import/export as a separate sharing envelope, including referenced preset assignments and legacy-string compatibility.
- Conflict review with Replace bindings, Import without keys and Skip conflicts; detect current LumaUI/native bindings, cancel without changes and recheck replacements before commit.
- Validated batch binding API for one character-registry commit and one refresh per affected mounted collection.

- Independent headless native-action-bar preset, composed into the saved action-bar tree and included in sharing.

- Collection activation metadata and inspector controls: Condition met, Always, Never, player class, group conditions and native Edit Mode layout selection.
- Event-driven activation and cleanup, including gated nested presets, lazy source ownership and combat-deferred reconciliation.
- Unlock positions scoped to the active native layout key, with base geometry fallback and import/export persistence.

- Editable unit-portrait preset component with native square portraits, left-click targeting and right-click unit menus.
- One-time portrait insertion beside the saved player health/mana display, retaining custom dimensions and enabled state.
- Keep portrait interaction in a separate secure root so resource and timer visibility remain responsive in combat. Editor previews have no secure actions.

### Fixed

- Invalid typed component connections restore the previous accepted field and show actionable type/context errors, so selection, Undo and retries are no longer trapped by rejected form text.
- Missing required inputs in repeated children render a normalized empty preview cell instead of failing in the layout engine.
- Tie native player-frame hiding to the replacement collection's lifetime instead of also hiding unit frames in the default skin.
- Migrate the old default skin's global visibility into existing player collections without replacing edited layouts or changing their enabled state.
- Restore native frames when the last hiding collection stops; defer protected cleanup until combat ends.

## [0.1.1] - 2026-10-15

### Changed

- Repeat no longer generates a named `items` source. Its child has an explicit Item input; current-item connections work for all lists, and Data accepts typed `parent.$item` or visible `RepeatName.$item` expressions alongside dropdown choices.
- Preserve item source identity through component layers, notify consumers on keyed row updates, and remove only legacy empty list placeholders used exclusively by Repeat.
- New editor drafts start with an empty hierarchy. The first chosen element becomes the root; empty drafts persist and first-element/root removal supports Undo/Redo.
- Update wuira to 0.2.0 from npm and replace the legacy Spells enum with generated PaladinSpells members.
- Preserve existing spell IDs through explicit ranked members where short aliases differ.
- Remove two retired Sanctuary IDs absent from the Forever client catalog from the starter list. Existing saved collections remain unchanged.

- Use the generic native Encoding codec from wuira; keep preset formats, validation and dependency transport in LumaUI. Existing share strings retain their format.

## [0.1.0] - 2026-10-15

### Added

- Import copy creates a separate component with a unique ID, preserving existing components and reusing equivalent Click Cast presets.

- Registered component/source factories and separate preset and native-skin runtimes.
- UI Library with native CBOR/Deflate/Base64 import/export and character-persistent collections.
- Reusable preset references with independent library records, dependency markers and complete dependency transport in one string.
- Headless presets, fragment groups and a native unit-frame visibility effect, with preview isolation and owned cleanup.
- Shared theme, customization dashboard, minimap launcher, layout unlock and keybind editing.
- Optional visual editor with actual-size previews, scrollable drag/drop hierarchy, grouped property forms, source creation and source-path bindings.
- Optional action-bar addon with a one-time spell collection starter and native bar controls.
- npm-workspace monorepo for the master, Editor and ActionBars; wuira remains an external dependency.
- Shared portable build/deploy scripts and one compiled addon-suite ZIP with SHA-256 checksum.
- Tag-triggered GitHub Releases using version-specific changelog notes.

### Changed

- Repeat no longer generates a named `items` source. Its child has an explicit Item input; current-item connections work for all lists, and Data accepts typed `parent.$item` or visible `RepeatName.$item` expressions alongside dropdown choices.
- Preserve item source identity through component layers, notify consumers on keyed row updates, and remove only legacy empty list placeholders used exclusively by Repeat.
- New editor drafts start with an empty hierarchy. The first chosen element becomes the root; empty drafts persist and first-element/root removal supports Undo/Redo.
- Player resources and action bars render from one-time saved starter collections instead of regenerating user layouts.
- Editor and ActionBars consume the current master contract through workspace links instead of packed contract copies.
- Build output defaults to local `dist`; game deployment uses an ignored local configuration or output-root environment variable.

### Fixed

- Invalid typed component connections restore the previous accepted field and show actionable type/context errors, so selection, Undo and retries are no longer trapped by rejected form text.
- Missing required inputs in repeated children render a normalized empty preview cell instead of failing in the layout engine.
- Preserve collection edits, source bindings, positions and optional-addon ownership across reloads.
- Keep editor navigation open while selecting hierarchy elements and provide usable preview samples for inactive sources.
- Reject cyclic or missing preset dependencies and conflicting shared IDs before applying an imported collection.
- Restore shared native visibility only after its last owner is released.
