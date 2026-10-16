# Builder API

The master exposes `LumaUI.Presets` and `LumaUI.Skins` through the `lumaui/core` contract. Optional addons supply additional compiled factories and native adapters. Imported strings contain data, never TypeScript or executable Lua.

## Component components

A component stores its stable ID, component tree, source definitions and optional owner addon. Source names are local to the component. A referenced source is constructed once and reused by its consumers; unused definitions stay uninstantiated. Sources and bindings are released when the component is removed.

`Create(document)` returns a view and ownership handle. `Mount(document)` creates a new tree and replaces the previous mounted component with that ID. Its `Nodes` map exposes native frames by stable node ID. `ObserveMount(listener)` allows controls to attach and clean up without owning the renderer. Explicit mounts replace root trees. Keyed ForEach lists reconcile their item trees incrementally; frame pooling is not implemented.

`Save(document, enabled)` persists detached data. `List`, `Get`, `Delete`, `Import` and `Export` manage the library. Enabled components restore on startup; optional owner addons defer restoration until their ADDON_LOADED event. `Unmount` suspends a component for the current session. Disable it in the library to persist that choice.

`RegisterComponent` and `RegisterSource` register names, property schemas and compiled creation functions. Initial components are Cell, Flow, Grid, Progress, Label, Icon and SecureButton. Initial sources include HP, mana, aura, cast, swing, GCD, spell cooldown, spell actions, totems and derived source channels.

Nodes can refer to activity, text and alpha sources using `visibleSource`, `textSource` and `alphaSource`. These links become trusted runtime callbacks; no functions are serialized. `channel` sources reuse a parent source's channel, such as a mana source's regen timer.

The optional player and action-bar import strings contain starter snapshots. Future learned spells are not automatically appended to a user-edited component. Existing spell actions resolve their localized names/ranks through SpellSource. Known-spell list helpers can create dynamic button trees; see the Known spells section below.

## Native skins

Skin documents contain registered target names and validated properties. `RegisterTarget(name, adapter)` defines the native adapter and its cleanup. `Apply` calls that adapter against existing Blizzard widgets; it does not produce a replacement component tree. One active skin owns a given registered target.

Initial targets: `unitFrames`, `microBar` and `compactMicroMenu`. The unit-frame target controls native visibility while preserving handlers. MicroBar cleanup stops skin maintenance; a reload restores the game's original textures.

## Sharing and persistence

Both document kinds use `!LUMA:1!` followed by native CBOR / Deflate / Base64 encoding. Import checks the format, version, registered names, allowed properties, IDs, child counts and data bounds. It never calls loadstring or creates addon files.

Component format, dependency transport and import/export policy belong to LumaUI. wuira supplies the generic Encoding codec, TextInput and native widgets. Component data is stored under `lumaui.builder` in the master's per-character SavedVariables. The visual editor keeps a separate working draft until its Save action commits the component.

## Headless and reusable components

A registered component may use `headless: true` and `Apply(props, context)` instead of `Create`. `Apply` returns its cleanup callback. Effects run only during `Mount`; neither `Create` nor `Preview` executes them. `Dispose` restores effects outside combat. Headless instances have no `View` or `Frame`.

The built-in `hideActionBars` has no properties and hides stock action bars through shared, reversible ownership. It leaves native events, scripts and action slots intact. Any component can reference a separate headless hiding component; deactivation restores bars when no other component owns their hiding. Manual slot backup/clear/restore commands are provided by the core and have a separate lifetime.

The built-in `hideUnitFrame` accepts `unit: "player" | "target" | "focus"`. A `fragment` groups headless effects without adding layout space. A `preset` node uses a library ID:

```ts
{ id: "hide-native-player", type: "preset", preset: "hide-player-frame", props: {} }
```

Referenced components remain independent library items. Source names and node IDs are scoped to each use; mounted nested node keys use `referenceId/innerNodeId`. A visual reference is positioned relative to its container; its old screen position is not reused. Cell limits count only visual children. Preview disables native effects and action buttons.

Export resolves all transitive dependencies into one string. Import validates the entire graph before saving each component separately; newly imported dependencies start disabled as standalone entries, but run when used by a mounted parent. Existing identical dependencies are reused. Conflicting dependency IDs are rejected rather than overwriting another component. Editing a shared dependency refreshes mounted consumers. Library entries show their users and cannot be deleted while referenced. Cycles, missing references and excessive graph sizes are rejected.

In the editor, choose **New → Headless component**, then **Add element → Hide native unit frame**. **Add component** inserts a library reference into the selected container. Use UI Library to edit the referenced component itself.

## Component activation and native layouts

Component rules are LumaUI document metadata, shown in the editor's **Component**
tab. The displayed declaration is a readable summary, not executable XML:

```xml
<!Collection preset="player-resources" class="PALADIN" condition="inParty" layout="1::Raid" enabled="condMet" />
```

- `condMet` requires every selected rule: player class, group condition and native layout.
- `always` bypasses class, group and layout rules. A manually displayed roster includes your own unit while solo.
- `never` disables the component before checking any of its rules.

Library **Enable** selects `condMet`; **Disable** selects `never`. Existing documents
without metadata retain their saved enabled state and have no additional rules.
Supported conditions are `inParty` (excluding raids), `inRaid`, `inGroup`, and
`solo`. An unavailable required API fails closed. There is no arbitrary condition
expression evaluation.

`Apply(document)` saves the rules and reconciles activation.
`SetActivation(id, mode)` updates the saved mode. `ActivationStatus(id)` exposes
active, disabled and waiting states. Roster, world-entry, addon-loading and native
layout events drive reconciliation; no per-frame condition polling runs. When a
component becomes ineligible, its view, sources, timers and owned native effects
are released. Definitions remain saved. Protected structural changes wait until
combat ends, then use the current state rather than a queued stale selection.

Referenced components also honor their own rules. A disabled standalone library entry
can still be used by a parent, but its explicit `never` metadata blocks that use.
Changing a nested rule rebuilds active consumers. Editor preview ignores activation
rules and keeps native effects and secure input disabled.

`LumaUI.Presets.Layouts` exposes wuira's shared `EditModeLayouts` source. The
**Native Edit Mode layout** dropdown binds a component to a local game layout.
Forever exposes one-based indices, not immutable layout tokens. wuira derives a
key from native type, interface style and name; index shifts preserve the key.
Renaming a layout requires selecting it again. Importing a component does not
create the recipient's native game layout; choose an existing matching layout or
**Any layout** after import.

Unlock saves component positions in `layoutPositions[activeLayout.key]`, leaving
the original root geometry as the fallback. Switching native layouts restores
their own positions. With no readable active game layout, unlock continues to save
the base position. Component rules and per-layout coordinates survive draft save,
SavedVariables and import/export.

LumaUI uses the published wuira 0.2.3 package from npm. The dependency and lockfile
pin the release; no local framework package is required.

## Character keybindings

Component trees describe visuals and actions; character bindings live under the separate lumaui.component-bindings SavedVariables token. Existing persisted button props migrate once. New/imported components, editor Save and reapplying components do not set or overwrite keys. Exports exclude keybinding props. The optional transfer layer can carry character assignments separately.

Use Core.Components.SetBinding(collectionId, buttonId, key) to assign a key, omit the key to unbind, and read it with Core.Components.GetBinding(collectionId, buttonId). Stable component and button IDs retain assignments. Reassigning a key removes the previous character assignment and refreshes mounted consumers, including nested components. Changes require being outside combat.

## Optional binding transport

The master transfer dialog asks whether to include keybindings (off by default). Plain component strings retain the !LUMA:1! format. PresetTransfer uses a !LUMA:2! envelope for a validated document and independent component/node/key records; neither saved component props nor editor drafts gain keybinding fields. Referenced component assignments are included once. Legacy strings remain readable, with embedded keys extracted as optional transport metadata.

The importer lists conflicting LumaUI and available native game bindings before committing. **Replace bindings** assigns the imported keys through the existing registry, **Import without keys** changes no bindings, and **Skip conflicts** applies only non-conflicting entries while retaining existing assignments. Cancel writes nothing. Replacement rechecks the displayed conflicts, and changed conflicts require another review. Importing from UI Library applies the chosen binding policy and saves an inactive component. Edit and Save explicitly to update its layout. All binding writes require being outside combat.

Batch assignment uses Core.Components.SetBindings(document, assignments). Every target must be a secure button in the document or its dependencies, and keys and targets must be unique in the batch. Core.Components.ListBindings() returns detached character assignments.

## Terminology

The interface calls each saved reusable tree or headless behavior a **component**. **Collection** is reserved for grouping multiple components. Existing preset API names, stable IDs, SavedVariables keys and import formats remain compatible.

## Click Cast library

Click Cast presets are a separate library of versioned `clickCast` records. The built-in **Standard** preset is always available and locked: left click targets the unit and right click opens its context menu. Named presets store a list of mouse/spell bindings (for example `BUTTON1` → Holy Light and `SHIFT-BUTTON1` → Flash of Light). Add or remove rows in the Click Cast page. Combinations are canonicalized and must be unique within a preset; different presets may reuse them. Existing single-binding records migrate automatically to version 2. Unmapped clicks retain the standard target/context actions. Each SecureButton references one preset, and any number of SecureButtons can share that preset. The button's own `unit` determines the target. Native secure attributes apply the combination; no global keyboard override is installed. Different presets may use the same mouse combination on different buttons. Manage presets from the **Click Cast** page, then choose one in the SecureButton **Actions** inspector. Definitions are stored in their own `lumaui.click-cast-library` SavedVariables token, independently of component definitions.

### Party and raid starter components

**Paladin healer · Party** and **Paladin healer · Raid** are optional built-in import strings. They are installed only after the user confirms Import. They activate for Paladins in their respective group type and can be disabled, moved or edited like other saved components. Existing edited components are never replaced by catalog registration or reload.

Each uses a `groupMembers` source and a keyed `foreach` template. The source returns the actual roster, including offline members. Party accepts a second template for separate pet cells: players come first, followed by existing pets in their owners' order, with five cells per column. Raid groups existing members by their native subgroup and shows a small pet row inside each member cell. `$unit` and `$pet` are shared unit references within that copy, rather than baked unit-token strings.

The native GUID is the primary key. Full name plus realm is the fallback, and a previously observed GUID remains associated with that identity if temporarily unavailable. For pets, fallback names are scoped to their owner. A roster update takes a small snapshot and reconciles keys: unchanged members retain their native cells, HP/power sources and subscriptions. DC/online causes no allocation. A member moving from `party2` to `party1` retargets the existing source and secure buttons together outside combat. Removed members dispose their own scope; new members create only their own scope.

The filled class-colored strip on the left uses **Standard** selection/context-menu actions. The heading is transparent, the health bar omits its percentage row, and the primary-resource strip is two UI units high. The health area shares **Paladin · Heal**, the disease/poison compartment shares **Paladin · Purify**, and the movement compartment shares **Paladin · Freedom**. The initial spell IDs are editable in Click Cast. These presets are independent library records; component export currently contains their references, so the receiving library must also contain the corresponding Click Cast records.

Health uses native HP sources with optional heal/absorb overlays. The resource strip displays current primary power, including mana, rage and energy. Names, health numbers, roles, leader indicators and aura icons update from events. Health numbers go directly to native font formatting without arithmetic on restricted values.

Aura compartments show a thin border only when a matching aura is present, with a light background on hover. Empty categories hide their icons and styling. Their secure click regions remain allocated and keep the same actions during combat; visual changes never change protected attributes or visibility. Disease/poison uses the client's `HARMFUL|RAID_PLAYER_DISPELLABLE` filter before checking readable dispel types. Slow/root categorization uses `movementSpellIds`, an editable starter list rather than an exhaustive mechanic database. `?` means that a category or API result is unavailable/restricted; it does not mean the unit has no debuffs.

There are no speculative unit slots. Structural roster updates, token retargeting, group switches, applying edits and cleanup reconcile after combat. While fighting, the retained cells continue reading the same native unit tokens used by their secure actions; the latest roster reconciles once combat ends. The editor uses sample icons/resources and disables all secure actions. Saved components and editor drafts are never rewritten to match a newer built-in template.

## Known spells and item templates

LumaUI owns these selection helpers; wuira continues to supply the native cached spellbook and widgets. Expressions select registered compiled factories and serialize as data. No TypeScript, Lua, loadstring or filesystem code is generated in the game.

In the editor, choose **New > Spell list**, select ForEach, then set **Data > List helper**:

```text
KnownSpells("Holy Light", "Seal*", /^Blessing of .*/i)
```

The same document can be authored directly:

```ts
const document: PresetDocument = {
    version: 1, kind: "preset", id: "my-spells", name: "My spell buttons", sources: [],
    root: {
        id: "spells", type: "foreach",
        items: 'KnownSpells("Seal*", /^Blessing of .*/i)',
        props: { direction: "horizontal", wrapAfter: 8, gap: 4, lineGap: 4 },
        children: [{
            id: "button", type: "secureButton", source: "item",
            props: { width: 24, height: 24, finishGlow: true },
            children: [{ id: "icon", type: "icon", source: "item", props: { width: "inherit", height: "inherit" } }],
        }],
    },
};
```

`items` is an alternative to a named `source`; choose one. To reuse a named list, create a `knownSpells` source with `selectors: '"Seal*", /^Blessing/i'`, then select it as the ForEach source. Empty filters include all known active spells. Set `includePassive: true` to retain passive entries; unknown passive status is excluded from active-only lists.

Each result is the native metadata object `{ id, name?, isPassive? }`. ForEach supplies the current object to compiled factories through `context.Item()`. The reserved `item` source binds that spell's action, texture and cooldown once per template instance; `textSource: "item"` supplies its name. In the editor, this source is labeled **Current item**. Outside an item template, `item` is invalid. Its name is reserved and cannot be used for a component's own named source.

Generated spell buttons currently provide secure clicks and cooldowns. The existing hover keybind mode targets saved static button nodes; independent keyboard bindings for generated items require a separate extension to the binding registry.

The source supplies identity; spell items use their IDs, unit items their GUID keys. Templates need no key property or hand-written per-spell sources. Multiple selectors use OR and a spell ID appears once, even when several filters match. Learned ranks remain separate entries. Event updates retain unchanged cells and source instances, create only newly matched spells, and dispose removed spells. Combat defers protected structural changes. Import/export and SavedVariables retain the expression and template, not generated children. A restricted spellbook retains the last readable selection until readable events resume.

String selectors are whole-name globs (`*`, `?`) and ignore ASCII case. Regex selectors search the name unless anchored and support `.`, `*`, `+`, `?`, `^`, `$`, character classes/ranges, and `\d`, `\w`, `\s` with their uppercase inverses. Only the `i` flag is supported. Groups, alternation, counted repetitions, lookarounds and backreferences are rejected. Matching is bounded and byte-oriented; names use the client's language, and case folding is ASCII rather than full Unicode.

Compiled LumaUI modules can also iterate the helper directly:

```ts
const spells = LumaUI.Helpers.KnownSpells("Seal*", { regex: "^Blessing", flags: "i" });
for (const spell of spells) console.log(spell.id, spell.name);
const stop = spells.onChange(items => console.log(items.length));
// When the owner is removed: stop(); spells.Dispose();
```

The direct helper retains passive metadata; the builder's spell-button source defaults to active spells. Native JavaScript RegExp objects are not used by Lua: `/pattern/i` belongs to the builder expression grammar, and compiled TypeScript supplies `{ regex, flags }`. Cached `Value` reads and iteration perform no spellbook polling.

Additional helpers can use `Presets.RegisterListHelper(name, { source, Parse })` and a registered source factory. A list source implements `items: { Value, onChange }`, supplies `ItemsKey`, and optionally `BindItem(read)` to expose a source for the current result. Unit lists also supply `ItemsUnit`, `ItemsGroup` and `ItemsTemplate`; the generic renderer does not assume every item represents a unit.

## Character action factory

LumaUI.Helpers.PlayerActions() creates a disposable, cached observable/iterable list. Entries have key, category, name, optional detail/icon, and a spellId, itemId or named macro action. Categories are spell, item, consumable and macro. Passive spells, items without use effects and ambiguous duplicate macro names are omitted. Native spellbook, equipment, bag, item-cache and macro events refresh the list; reading Value never polls the game.

Click Cast presets accept multiple key/action pairs. Each pair contains exactly one of spellId, itemId or macro; combinations must be unique only within that preset. Items use native item actions and macros use their native name, retaining their own targeting logic. Unavailable saved choices are not silently replaced.

## Built-in preset strings

BuiltinPresets is a string-only object, exposed as LumaUI.BuiltinPresets. The player, party, raid and skin strings are generated from presets/catalog.json and the canonical .luma.txt files. They are not decoded or installed at startup.

RegisterBuiltinPreset({key, name, kind, importString}) adds a string and separate display metadata to the catalog; factories and Create callbacks are rejected. OpenImport(kind, callback, importString) prefills the normal confirmation dialog. Confirmed imports start disabled, and existing component IDs cannot be overwritten. The editor remains the explicit update path. The v3 transport carries named click dependencies separately from component props and optional character keybindings; imports preserve existing mappings by remapping conflicting IDs. Startup restores only the user's saved library.

Action buttons are ordinary components, created in the editor or imported as data. Use a ForEach with KnownSpells to build a filtered spell list, or configure individual secure buttons. There is no separate ActionBars addon or startup action-layout generator. Existing saved components from the retired addon lose only their obsolete owner field; trees, IDs, activation rules and independent bindings remain unchanged.

## Native action slots

The core retains `/lumaclearbars` and `/lumarestorebars` and the existing `LumaUIActionBarBackup` SavedVariables format. These commands never run automatically. Without a saved backup, the first clear command captures slots and asks for `/reload`; a second explicit command after reload can clear them. Restore reuses an existing saved backup. Both commands are blocked during combat and do not change bar visibility. Normal component initialization does not read native action slots.

## Editor workspace

Customization pages can declare workspace: true to use the full content width without the configuration sidebar. Back returns to the previous regular page. LumaUI.Editor registers a preset creator as well as an editor; UI Library calls CreatePreset(kind), while EditPreset(document) loads a saved component. Creation only opens a draft until Save. The editor uses one Save command to validate pending fields and reconcile the live component. Panel focus, folds and selection overlays remain editor-only state.
