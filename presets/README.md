# Optional starter imports

Copy the entire contents of a .luma.txt file into LumaUI's Import dialog. Nothing in this directory is loaded automatically.

- paladin-actions.luma.txt: the editable 32-button Paladin action layout, native action-bar hiding dependency and action tooltips; no character keybindings.
- player.luma.txt: player resources with its separate headless native-player-frame dependency.
- paladin-party.luma.txt: compact party cells with separate pets, fixed Purify indicators and named heal/Purify/Freedom click presets.
- paladin-raid.luma.txt: compact raid groups with inline pets and the same named click presets.
- blizzard.luma.txt: the optional Blizzard presentation skin.

Imports start disabled. Enable them in UI Library; the editor's Save keeps your edits and updates the live component while respecting its activation rules. To update an existing component with the same ID, import into the editor and review before Save. A direct library import refuses to overwrite an existing ID. Your separate keybindings are omitted.

These examples use representative Paladin spell IDs. Choose the learned spell/rank you want in Click Cast after importing. Referenced click presets are imported separately and can be shared by multiple buttons.

These .luma.txt files are the source of truth. Create or edit a component in the game, export it, and replace the corresponding file to update an example. catalog.json supplies its code key, display name and import kind.

Run npm run presets:generate to embed the strings in addons/core/src/BuiltinPresets.ts. Normal builds do this automatically. BuiltinPresets contains strings only; labels and kinds are separate metadata. The Built-in presets page opens a prefilled import dialog without decoding or saving until Import is confirmed.

- player-unit-frame.luma.txt and target-unit-frame.luma.txt: independent copies of the Paladin party member cell, with fixed player/target data, the same click presets and no party-only activation condition. Target uses secure unit-watch visibility. Native player/target frames are not hidden by these imports.
