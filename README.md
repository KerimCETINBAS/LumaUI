# LumaUI

<p align="center">
  <a href="assets/branding/lumaui-logo-v1.png">
    <img src="assets/branding/lumaui-logo-v1.png" alt="LumaUI logo" width="280" />
  </a>
</p>

**Build an interface that fits the way you play.**

LumaUI is an in-game UI builder for **WoW Forever**. Create resource displays, cooldown buttons and party or raid layouts, arrange them on your screen, and share your work with a single import string.

Start with a built-in preset or a blank canvas. Shape it in the visual editor, connect it to game data, and save it as a reusable component.

[Download](https://github.com/kerimcetinbas/LumaUI/releases) · [Editor guide](https://github.com/kerimcetinbas/LumaUI/blob/main/packages/editor/README.md) · [Changelog](CHANGELOG.md) · [Report an issue](https://github.com/kerimcetinbas/LumaUI/issues)

LumaUI is in active development, with WoW Forever as its current compatibility target.

## Make the information yours

Put health, resources, buffs, casts and cooldowns where they make sense for you. Combine bars, text, icons and buttons with flow or grid layouts. Adjust their size, spacing, textures and colors in the editor.

Build one party member template and repeat it across the group. Create a spell-button template and populate it from your learned spells using name filters. Reuse a component inside another component to keep related displays consistent.

## Design while you play

The optional visual editor gives your work the full configuration workspace:

- A ribbon of element tools and reusable components, with a textbox to filter your library.
- A collapsible hierarchy with drag-and-drop ordering and nesting.
- A shared preview with click-to-select, zoom controls, 1:1 sizing and Fit.
- Expand any panel, with Preview, Component and Sources tabs in the center workspace.
- Organized properties, editable data sources and activation rules.
- Undo/redo for layout, property and source edits, including deleted element trees.
- One **Save** action with an unsaved-changes indicator.
- Combat pauses the editor and restores its unfinished forms and workspace when combat ends.

Use **Unlock** to position your components on the game screen. Choose when they load by class, party or raid state, or the active native Edit Mode layout.

## Share data between components

In a child component's **Sources**, create a source with your own name and type, then enable **Expose as prop**. Choose **Optional input** when the child can work without it. Inputs declare a contract; they do not create a source or observer. UnitSource, health, mana, lists and converter outputs use the same system.

Select the child reference in its parent and open **Inspector > Data**. Each input shows its name, type and required/optional state. Pick a compatible parent source from the dropdown. The existing instance is shared; children own only their subscriptions and locally derived sources.

**Repeat** contains one component reference, with an optional second reference for pets. Each result has a separate child scope. Save the parent before opening a child definition so unfinished parent edits remain safe. For a roster, expose a **UnitSource** input such as `NamedUnitSource` on the child, use that name in its local HP/Mana/unit fields, then connect it to **parent.$unit** in the reference's Data tab. Nested Repeat resolves its own current member; further component layers forward named inputs. Every list can pass **parent.$item** into a **Repeat item** input. Repeat creates no named `items` source; choose its list in Data or enter a list helper. Reference Data fields accept dropdown choices or typed expressions (`parent.$item` or `VisibleRepeatName.$item`), applied with **Apply connection** or **Save**. Named context expressions resolve only against the Repeat creating that reference. Roster items also accept a UnitSource input; derive Class/HP/Mana from that input inside the child rather than connecting a raw item to a Unit class input. Legacy inline templates are extracted into visible, editable component definitions during validation/import; both member and pet slots are retained.

Use **Rename source** in Sources and choose whether to update references. Yes updates local links and, for public inputs, saved caller bindings when you save the component. No keeps the old links visible as missing references for manual repair. Source renames support Undo/Redo and saved drafts; names are used exactly as entered, with no hidden connection aliases. Missing or incompatible bindings remain editable, and runtime refuses invalid connections. Protected changes still wait until combat ends.

## Give each click a purpose

Turn a spell into a cooldown button, assign a key, or attach a named Click Cast preset to a unit button. Search your character's learned spells, usable items, consumables and macros when choosing an action.

A Click Cast preset can hold multiple mouse and modifier combinations and be reused across buttons. Friendly and Enemy checkboxes restrict which clicked units can invoke its bindings. Only clicked unit uses an explicit spell/item target with no fallback clause; named macros retain their own targeting and cannot use that option. The built-in **Standard** preset provides left-click selection and a right-click unit menu.

## Share what you build

Export a component as one string. Its nested components and named Click Cast dependencies travel with it, and appear as separate reusable entries in the receiving library.

Keyboard bindings stay in character settings and are excluded from sharing by default. You can include them explicitly; when assignments conflict, choose to replace them, import without keys, or skip conflicts.

Components can also carry behavior without a visible widget. For example, a custom player display can include a separate component that hides the native player frame and restores it when the last owner is disabled.

## Install

Download the compiled **LumaUI-<version>.zip** asset from [GitHub Releases](https://github.com/kerimcetinbas/LumaUI/releases) and extract its addon folders into your client's `Interface/AddOns` directory:

```text
Interface/AddOns/
  LumaUI/LumaUI.toc
  LumaUI_Editor/LumaUI_Editor.toc
```

Enable the modules you want in the game's addon list, then reload.

| Addon | What it adds |
| --- | --- |
| **LumaUI** | Component library, import/export, Click Cast presets, shared settings and customization dashboard. |
| **LumaUI.Editor** | Visual tools for creating and editing components. Requires LumaUI. |

Release files contain the compiled addon. Players do not need Node.js or a separate wuira installation.

When upgrading from a build that included **LumaUI.ActionBars**, remove the old `LumaUI_ActionBars` folder. Saved action components and character bindings continue through the core. The `/lumarestorebars` command remains available to restore an existing native slot backup.

## Your first component

1. Open **`/luma`**, the **L** launcher beside the minimap, or LumaUI in game options.
2. Open **Built-in presets**, choose a starter and confirm **Import**. Imported components start disabled; enable the one you want in **UI Library**.
3. With the Editor enabled, choose **Edit**, customize the component and press **Save**. To start from scratch, choose **New** beside **Import component** in UI Library. New drafts have an empty hierarchy; the first element you add becomes the root. Build any component with the shared element and source factories.
4. Use **`/luma unlock`** to move it, **`/luma bind`** to assign keys, and **`/luma lock`** to finish.

Built-in presets are optional imports. Your saved layouts, activation rules and bindings remain your own as the addon develops. The party and raid starters currently include Paladin click actions; choose the spells and ranks you want in **Click Cast**.

For a solo preview of a group component, enable it and choose **Always** in the editor's **Component** tab, then **Save**. Use **Condition met** to follow its normal loading rules. Make layout and binding changes outside combat.

**Export** in UI Library selects the share string; press **Ctrl+C** to copy it. Settings are saved per character through the game's SavedVariables system.

## Follow the project

See the [editor guide](https://github.com/kerimcetinbas/LumaUI/blob/main/packages/editor/README.md) and [changelog](CHANGELOG.md). When reporting an issue, include your LumaUI version, client build, steps to reproduce and any Lua error.

LumaUI is built with [wuira](https://www.npmjs.com/package/wuira), the separate TypeScript/JSX framework. Developers can extend it through registered components, sources, list helpers and native skin adapters. See [development and releases](docs/development.md) and the [Builder API](docs/builder.md).

Our next distribution milestone is a tested CurseForge release. The [release preparation plan](docs/release-readiness.md) tracks the remaining presentation, onboarding and compatibility work.

[MIT licensed](LICENSE).
