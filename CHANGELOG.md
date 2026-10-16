# Changelog

All notable changes to the LumaUI addon suite are recorded here. Core and Editor share one release version.

## [Unreleased]

### Removed

- Retire the LumaUI.ActionBars workspace, addon and character-specific Paladin layout generator. Core and Editor now build and ship as the complete suite; action buttons remain ordinary editable components.

### Fixed

- Expose repeated lists and all registered visual elements in the editor. Allow adding and dragging into member templates and keep the selected component name visible.

- Keep character keybindings in a separate collection/node registry. Editor Apply, stale imports, reloads and reapplying components cannot restore embedded default keys. Migrate existing saved bindings once, including explicit unbinding.

### Changed

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

- Tie native player-frame hiding to the replacement collection's lifetime instead of also hiding unit frames in the default skin.
- Migrate the old default skin's global visibility into existing player collections without replacing edited layouts or changing their enabled state.
- Restore native frames when the last hiding collection stops; defer protected cleanup until combat ends.

## [0.1.1] - 2026-10-15

### Changed

- Update wuira to 0.2.0 from npm and replace the legacy Spells enum with generated PaladinSpells members.
- Preserve existing spell IDs through explicit ranked members where short aliases differ.
- Remove two retired Sanctuary IDs absent from the Forever client catalog from the starter list. Existing saved collections remain unchanged.

- Use the generic native Encoding codec from wuira; keep preset formats, validation and dependency transport in LumaUI. Existing share strings retain their format.

## [0.1.0] - 2026-10-15

### Added

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

- Player resources and action bars render from one-time saved starter collections instead of regenerating user layouts.
- Editor and ActionBars consume the current master contract through workspace links instead of packed contract copies.
- Build output defaults to local `dist`; game deployment uses an ignored local configuration or output-root environment variable.

### Fixed

- Preserve collection edits, source bindings, positions and optional-addon ownership across reloads.
- Keep editor navigation open while selecting hierarchy elements and provide usable preview samples for inactive sources.
- Reject cyclic or missing preset dependencies and conflicting shared IDs before applying an imported collection.
- Restore shared native visibility only after its last owner is released.
