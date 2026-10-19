# LumaUI.Editor

Optional in-game visual component editor for LumaUI, built with wuira.

Create a component in **UI Library** using **New** beside **Import component**. New drafts start with an empty hierarchy. The first element you choose becomes the root; no Cell, group or component is inserted automatically. Add visual layouts or headless effects through the same toolbox. Existing saved drafts and components keep their content. Use a saved component's **Edit** action to open it. Import and Export belong to the library.

The editor occupies the full configuration content area, without the navigation sidebar. **Back** returns to the previous configuration page. **Design** shows the hierarchy, preview and inspector together; **Preview**, **Hierarchy** and **Inspector** focus that panel across the workspace. These preferences do not change component data.

The ribbon groups elements into **Layout**, **Visuals**, **Units** and **Effects**, with a separate row of icon tools. **Components** displays as many saved component buttons as fit. Filter by name or ID in its textbox; typing retains focus and Escape clears the filter. Choose a component to embed a shared reference inside the selected container.

Double-click the component name at the top to rename it. Enter stages the name, Escape cancels, and **Save** persists it. Saving while the name input is focused also confirms it. Renaming preserves component IDs, references and character bindings.

The hierarchy has fixed-width rows, disclosure buttons, readable names and spell icons. Helper children start folded. **Expand all** and **Collapse all** affect only the view; selecting a descendant opens its ancestors and scrolls it into view. Drag rows to their siblings' top/bottom edges to reorder, or into the middle to nest. Invalid child counts and ancestor cycles are rejected.

The preview uses the same factories and layout engine as mounted components. It centers visuals at their actual size without changing saved screen anchors. Click a visual to select it; a spell's icon selects its action button. The highlighted path identifies its place in the component. Preview actions remain disabled. Inactive sources use sample visuals.

**Properties** groups Display, Layout, Data and button Actions. Display properties offer either a static value or a source/path in the same field; bound color fields hide their static RGBA controls. Visibility, text, icons and progress values keep their source selection beside their visuals. Data contains unit/filter/list configuration without repeating appearance controls. **Update preview** stages property edits without saving the live component. **Sources** shows every named source in a scrollable card list separated by rules. Each card contains its own fields, including case converter matches and outputs. **Update source** stages one card; **Update all sources** validates all pending cards together. The main **Save** commits pending property/source edits, persists the component and updates it in the game when activation rules match. It preserves manual disable, character bindings and component ownership. Invalid input leaves the saved component intact.

The Effects toolbox has one **Hide frame** tool with Player, Target, Focus and Action bars targets. Old bar-only effects remain importable and keep reversible ownership.

Forms and option lists use native mouse-wheel scrolling, with no previous/next pages. Long forms also show a scroll-position indicator. Typed form values are retained when switching panel views or returning to configuration.

**Component** configures Condition met, Always or Never, player class, group condition and native Edit Mode layout. Unlock positions remain scoped to the active native layout.

To build party or raid frames, add **Repeat** (ForEach), create a **Group members** source in Sources, and bind it to the list. Repeat contains component references only; its optional second component slot represents pets. Select a slot and use **Edit component definition** to edit the child in its own scope. Expose a named **UnitSource** input in the child Sources, then use that name in the child's local HP/Mana and unit fields. Back in the parent, select the reference and connect the input to **parent.$unit** under **Inspector > Data**. The runtime retains unchanged instances by GUID and retargets their shared unit reference when roster slots move. Legacy inline templates migrate to editable child definitions.

To build spell buttons, create a child component with an exposed **Repeat item** input (for example `Spell`), and bind its action, icon and text to that input. In the parent Repeat's **Data > List helper**, use expressions such as `KnownSpells("Holy Light", "Seal*", /^Blessing of .*/i)`. Connect the child input to **parent.$item** in its Data tab. Stable spell keys and consumer cleanup are automatic. Other source inputs can receive any compatible parent source, including a ready health source, list or converter output.

Sources cards include **Rename source**. Enter the new public name, then choose **Yes** to rewrite references or **No** to keep old references as missing links. Public input changes update caller binding names on Save. Undo/Redo includes the rename and its pending caller updates. No input declaration allocates a source; borrowed instances remain owned by the parent, while child-derived sources are disposed with the child. Incomplete connections remain editable and do not fall back to player data.

Tools, hierarchy entries and common controls share editable SVG glyphs from `packages/core/assets/icons/svg`. The build converts them to transparent native TGA textures and includes them in the core addon; feature addons use `LumaUI.Theme.icons`. Run `npm run icons:preview` to inspect the set.

Development is managed from the monorepo root: `npm ci`, `npm run check`, `npm run build`, `npm test`, and `npm run test:integration`. Run `npm run deploy` to install the addons into the configured local game directory.

Repeat starts without a named `items` source and stays empty until a list source or helper is selected. Its default child exposes an `Item: Repeat item` input connected to `parent.$item`. For an existing child, expose your own named input in its Sources panel, then select the child reference and open **Data**. Choose a compatible source or type `parent.$item` / `VisibleRepeatName.$item` in the text field; **Apply connection** and the main **Save** both commit it. The named form must match the creating Repeat's visible name; outer or sibling Repeat contexts are rejected. Each row reuses its own item instance and updates subscribers when its keyed record changes.

For roster HP/Mana/class data, expose a **UnitSource** input and derive these sources locally. Connect that input to `parent.$unit` (or `parent.$item`, which also carries the roster unit). A **Unit class** input expects an already derived class source and rejects a raw item. Old generated empty `items` list placeholders used only by Repeat migrate to an unconfigured Repeat; configured, shared and exposed lists remain intact.

Existing exposed inputs have a type selector in Sources. Change the type and **Update source** to repair a contract (for example, MEMBER from Unit class to UnitSource); callers remain subject to compatibility validation.

Rejected manual source connections restore the last accepted field value while keeping the explanation beside the input. Other pending edits are retained. You can retry, dismiss the error, change selection or use Undo without repeatedly submitting the same rejected text. Type mismatch messages distinguish a missing Repeat context from an incompatible input contract.
