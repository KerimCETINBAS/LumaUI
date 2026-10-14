# Builder API

The master exposes `LumaUI.Presets` and `LumaUI.Skins` through the `lumaui/core` contract. Optional addons supply additional compiled factories and native adapters. Imported strings contain data, never TypeScript or executable Lua.

## Preset collections

A preset stores its stable ID, component tree, source definitions and optional owner addon. Source names are local to the collection. A referenced source is constructed once and reused by its consumers; unused definitions stay uninstantiated. Sources and bindings are released when the collection is removed.

`Create(document)` returns a view and ownership handle. `Mount(document)` creates a new tree and replaces the previous mounted collection with that ID. Its `Nodes` map exposes native frames by stable node ID. `ObserveMount(listener)` allows controls to attach and clean up without owning the renderer. The initial renderer replaces trees; incremental reconciliation and frame pooling are not implemented.

`Save(document, enabled)` persists detached data. `List`, `Get`, `Delete`, `Import` and `Export` manage the library. Enabled collections restore on startup; optional owner addons defer restoration until their ADDON_LOADED event. `Unmount` suspends a collection for the current session. Disable it in the library to persist that choice.

`RegisterComponent` and `RegisterSource` register names, property schemas and compiled creation functions. Initial components are Cell, Flow, Grid, Progress, Label, Icon and SecureButton. Initial sources include HP, mana, aura, cast, swing, GCD, spell cooldown, spell actions, totems and derived source channels.

Nodes can refer to activity, text and alpha sources using `visibleSource`, `textSource` and `alphaSource`. These links become trusted runtime callbacks; no functions are serialized. `channel` sources reuse a parent source's channel, such as a mana source's regen timer.

The initial player and action-bar collections are one-time starter snapshots. Future learned spells are not automatically appended to a user-edited collection. Existing spell actions resolve their localized names/ranks through SpellSource. Dynamic list expressions remain separate work.

## Native skins

Skin documents contain registered target names and validated properties. `RegisterTarget(name, adapter)` defines the native adapter and its cleanup. `Apply` calls that adapter against existing Blizzard widgets; it does not produce a replacement preset tree. One active skin owns a given registered target.

Initial targets: `unitFrames`, `microBar` and `compactMicroMenu`. The unit-frame target controls native visibility while preserving handlers. MicroBar cleanup stops skin maintenance; a reload restores the game's original textures.

## Sharing and persistence

Both document kinds use `!LUMA:1!` followed by native CBOR / Deflate / Base64 encoding. Import checks the format, version, registered names, allowed properties, IDs, child counts and data bounds. It never calls loadstring or creates addon files.

Preset format, dependency transport and import/export policy belong to LumaUI. wuira supplies the generic Encoding codec, TextInput and native widgets. Collection data is stored under `lumaui.builder` in the master's per-character SavedVariables. The visual editor keeps a separate working draft until Apply.

## Headless and reusable presets

A registered component may use `headless: true` and `Apply(props, context)` instead of `Create`. `Apply` returns its cleanup callback. Effects run only during `Mount`; neither `Create` nor `Preview` executes them. `Dispose` restores effects outside combat. Headless instances have no `View` or `Frame`.

The built-in `hideUnitFrame` accepts `unit: "player" | "target" | "focus"`. A `fragment` groups headless effects without adding layout space. A `preset` node uses a library ID:

```ts
{ id: "hide-native-player", type: "preset", preset: "hide-player-frame", props: {} }
```

Referenced presets remain independent library items. Source names and node IDs are scoped to each use; mounted nested node keys use `referenceId/innerNodeId`. A visual reference is positioned relative to its container; its old screen position is not reused. Cell limits count only visual children. Preview disables native effects and action buttons.

Export resolves all transitive dependencies into one string. Import validates the entire graph before saving each preset separately; newly imported dependencies start disabled as standalone entries, but run when used by a mounted parent. Existing identical dependencies are reused. Conflicting dependency IDs are rejected rather than overwriting another preset. Editing a shared dependency refreshes mounted consumers. Library entries show their users and cannot be deleted while referenced. Cycles, missing references and excessive graph sizes are rejected.

In the editor, choose **New → Headless preset**, then **Add element → Hide native unit frame**. **Add preset** inserts a library reference into the selected container. Use UI Library to edit the referenced preset itself.
