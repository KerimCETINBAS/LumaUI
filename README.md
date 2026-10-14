# LumaUI

A customizable UI builder for WoW Forever, powered by [wuira](https://www.npmjs.com/package/wuira).

LumaUI turns saved presets into native WoW widgets. Compose resource displays, cooldown buttons and reusable layouts, customize registered Blizzard frames, and share a complete preset with one import string. Character settings and collections persist through SavedVariables.

## What it provides

- **Preset engine:** registered component and source factories create native UI trees from data.
- **Reusable collections:** reference another preset; exported strings include its transitive dependencies. Each imported dependency remains a separate library item with a **Used by** marker.
- **Headless presets:** apply behavior without drawing a widget, such as hiding the native player frame. Effects are disabled in editor previews and released when their owner is removed.
- **Native skins:** customize supported Blizzard frames through registered adapters.
- **Shared dashboard and theme:** one customization window, character settings, layout unlock and keybind modes.
- **Optional visual editor:** actual-size preview, a scrollable drag/drop hierarchy, grouped property forms and editable data sources.
- **Optional action bars:** a saved spell-button starter collection, secure bindings and native action-bar controls.

wuira is the separate TypeScript/JSX framework and toolchain. LumaUI is the addon runtime and preset engine built on it.

## Install

Download **LumaUI-<version>.zip** from this repository's GitHub Releases and extract it into your WoW Forever client's `Interface/AddOns` directory. The archive contains:

```text
Interface/AddOns/
  LumaUI/LumaUI.toc
  LumaUI_Editor/LumaUI_Editor.toc
  LumaUI_ActionBars/LumaUI_ActionBars.toc
```

Enable **LumaUI** in the addon list. **LumaUI.Editor** and **LumaUI.ActionBars** can be enabled independently; both require the master addon. Reload the UI after an update. The release contains compiled Lua and needs no Node.js installation in the game environment.

## Use

Open `/luma`, the L launcher beside the minimap, or the LumaUI entry in game options.

| Command | Behavior |
| --- | --- |
| `/luma` | Open the customization dashboard. |
| `/luma unlock` | Drag mounted collections to change their position. |
| `/luma bind` | Hover a secure button and press a key; Delete clears its binding. |
| `/luma lock` | Finish layout or keybind editing. |

In **UI Library**, apply, disable, edit, import or export a collection. **Export** selects its share string; press **Ctrl+C** to copy it. With the Editor enabled, use **New** to create a visual or headless preset, **Add preset** to insert a reusable dependency, and **Apply** to save and mount the result. **Save** retains the working draft.

The player panel and optional action-bar starter are seeded once. Later reloads use your saved collections instead of regenerating their layouts. ActionBars offers an explicit starter reset. Clearing or restoring native bar slots remains an explicit ActionBars command. Layout changes and native mutations run outside combat.

See the [Builder API](docs/builder.md), [Editor guide](addons/editor/README.md), [ActionBars guide](addons/actionbars/README.md) and [changelog](CHANGELOG.md).

## Monorepo

```text
addons/
  core/         LumaUI master and shared lumaui/core contract
  editor/       Optional visual editor
  actionbars/   Optional action-bar collection and native bar controls
tools/          Shared build and release scripts
tests/          Emitted-Lua runtime and cross-addon integration checks
docs/           Preset and skin API documentation
```

npm workspaces link the Editor and ActionBars directly to the master's current types. wuira stays an external dependency, outside this repository. The current framework preview is pinned in `.packages/wuira-encoding-20261015.tgz`; keep that file committed with `package-lock.json` so a clean checkout can build the same version.

## Development

Use Node.js 22.13 or newer and run commands from the repository root:

```sh
npm ci
npm run check
npm test
npm run build
npm run test:integration
```

`npm run build` compiles all three addons into `dist/<addon-name>`. The tests run emitted Lua against mocked native APIs; in-game testing remains part of development.

For local game installation, copy `lumaui.local.example.mjs` to `lumaui.local.mjs`, set `outputRoot` to your client's `Interface/AddOns` directory, then run `npm run deploy`. This local file is ignored by Git. The environment variable `LUMAUI_OUTPUT_ROOT` can also select an output directory.

## Releases

`npm run build:release` builds clean standalone addon folders, runs their integration checks, then writes `artifacts/LumaUI-<version>.zip`, `SHA256SUMS` and release notes. Windows uses PowerShell's archive support; Linux and macOS use `zip`.

All addon workspaces share one release version. For a subsequent release:

1. Run `npm version patch --workspaces --include-workspace-root --no-git-tag-version` (or choose a minor/major increment).
2. Move completed changes from **Unreleased** to a matching `## [<version>] - YYYY-MM-DD` section in `CHANGELOG.md`.
3. Commit the source, lockfile and changelog, then push a matching `v<version>` tag.

The release workflow checks the tag, workspace versions and changelog; installs locked dependencies; runs type/runtime checks; and publishes one GitHub Release containing all three compiled addons and their checksum. Prerelease versions produce prereleases. The workflow uses the repository's built-in `GITHUB_TOKEN`; it does not need an npm publish token. The initial version is `0.1.0`, matching tag `v0.1.0`.

## License

[MIT](LICENSE).
