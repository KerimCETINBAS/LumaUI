# Changelog

All notable changes to the LumaUI addon suite are recorded here. The three addons share one release version.

## [Unreleased]

### Changed

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
