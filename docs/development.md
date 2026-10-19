# Developing LumaUI

LumaUI is the addon runtime and component engine. [wuira](https://www.npmjs.com/package/wuira) supplies the TypeScript/JSX framework, native widgets and Lua toolchain as a separate npm dependency.

## Repository

```text
packages/
  core/         LumaUI runtime, shared theme and lumaui/core contract
  editor/       Optional in-game visual editor
  web/          Browser editor shell
tools/          Shared build and release scripts
tests/          Emitted-Lua runtime and cross-addon integration checks
docs/           User, extension and maintainer documentation
presets/        Canonical optional starter import strings
```

npm workspaces link Editor to the core's current types. The wuira dependency is pinned in `package.json`; the lockfile keeps dependency installation reproducible.

## Build and check

Use Node.js 22.13 or newer. Run these commands from the repository root:

```sh
npm ci
npm run check
npm run build
npm run build -- --web
npm test
npm run test:integration
```

`npm run build` writes the addon folders. `npm run build -- --web` writes the browser shell. Pass `--addons` and `--web` together to build both. `npm run deploy` still installs the addons into the local game directory.

Build before running the tests: editor, persistence and icon-packaging checks read the compiled output. The build creates two standalone addon folders under `dist/`. Tests exercise emitted Lua against mocked native APIs; manual testing in the supported client verifies game behavior and presentation.

The build also embeds the canonical starter strings and converts the original SVG glyphs into native textures. Use `npm run icons:preview` to inspect the icon set.

## Install locally

Copy `lumaui.local.example.mjs` to `lumaui.local.mjs` and set `outputRoot` to the client's `Interface/AddOns` directory. Then run:

```sh
npm run deploy
```

The local configuration is ignored by Git. `LUMAUI_OUTPUT_ROOT` can also select an output directory. Reload the game UI after deploying.

## Extend the runtime

The shared `lumaui/core` contract exposes component and source factories, iterable list helpers, native skin adapters and customization page registration. See the [Builder API](builder.md).

The master addon owns settings, the theme, import/export and component lifetime. Feature addons register capabilities and pages with it. Optional starter imports live in `presets/`; they are not installed or rewritten at startup. See the [starter guide](../presets/README.md).

## Release

Both addons share one version. For each release:

1. Run `npm version patch --workspaces --include-workspace-root --no-git-tag-version`, or choose a minor/major increment.
2. Move completed changes from **Unreleased** to a matching `## [<version>] - YYYY-MM-DD` section in `CHANGELOG.md`.
3. Run the build and checks above, then `npm run release:check`.
4. Run `npm run build:release` and test the resulting archive in the supported client.
5. Commit the source, lockfile and changelog, then push a matching `v<version>` tag.

`build:release` builds clean addon folders, checks their compiled Lua together, and produces `artifacts/LumaUI-<version>.zip`, `SHA256SUMS` and release notes. It includes both addons, native icon textures, optional starter strings, guides and licenses. Windows uses PowerShell archive support; Linux and macOS use `zip`.

The tag workflow validates version metadata, installs locked dependencies, builds and tests the addons, and publishes a GitHub Release with the archive and checksum. Prerelease versions produce GitHub prereleases. It uses the repository's built-in `GITHUB_TOKEN`.

CurseForge submission and publishing are a separate preparation milestone; see [release readiness](release-readiness.md).

## Client catalogs

Inspector spell lists are generated from the packaged `wuira/data/spells/forever.json`; icon choices use `wuira/data/icons/forever.json`. LumaUI owns the search interface, while wuira owns extraction from the pinned Forever client tables and the generated enums. Normal builds use committed generated search data without network requests.

The current dependency is published `wuira@0.3.0`. After upgrading the SDK, run `npm run catalogs:generate`. To validate an unreleased SDK, each generator accepts `--package <directory>` pointing to an extracted npm package.

## Source conversion

wuira owns the typed callback `SourceConverter`, checked reads and event subscription lifecycle. LumaUI owns serializable `caseConverter` and `mathConverter` factories, the formula parser and editor controls. See [source converters](source-converters.md) for authoring and binding examples.
