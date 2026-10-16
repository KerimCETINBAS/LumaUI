# LumaUI.Editor

Optional in-game visual component editor for LumaUI, built with wuira.

Create a component in **UI Library** using **New blank**, **New party**, **New raid**, **New spell list**, or **New headless**. Use a saved component's **Edit** action to open it. Import and Export belong to the library.

The editor occupies the full configuration content area, without the navigation sidebar. **Back** returns to the previous configuration page. **Design** shows the hierarchy, preview and inspector together; **Preview**, **Hierarchy** and **Inspector** focus that panel across the workspace. These preferences do not change component data.

The ribbon groups elements into **Layout**, **Visuals**, **Units** and **Effects**, with a separate row of icon tools. **Components** displays as many saved component buttons as fit. Filter by name or ID in its textbox; typing retains focus and Escape clears the filter. Choose a component to embed a shared reference inside the selected container.

Double-click the component name at the top to rename it. Enter stages the name, Escape cancels, and **Save** persists it. Saving while the name input is focused also confirms it. Renaming preserves component IDs, references and character bindings.

The hierarchy has fixed-width rows, disclosure buttons, readable names and spell icons. Helper children start folded. **Expand all** and **Collapse all** affect only the view; selecting a descendant opens its ancestors and scrolls it into view. Drag rows to their siblings' top/bottom edges to reorder, or into the middle to nest. Invalid child counts and ancestor cycles are rejected.

The preview uses the same factories and layout engine as mounted components. It centers visuals at their actual size without changing saved screen anchors. Click a visual to select it; a spell's icon selects its action button. The highlighted path identifies its place in the component. Preview actions remain disabled. Inactive sources use sample visuals.

**Properties** groups Display, Layout, Data and button Actions. **Update preview** stages property edits without saving the live component. **Sources** edits named source definitions; **Update source** stages the source. The main **Save** commits pending property/source edits, persists the component and updates it in the game when activation rules match. It preserves manual disable, character bindings and component ownership. Invalid input leaves the saved component intact.

Forms and option lists use native mouse-wheel scrolling, with no previous/next pages. Long forms also show a scroll-position indicator. Typed form values are retained when switching panel views or returning to configuration.

**Component** configures Condition met, Always or Never, player class, group condition and native Edit Mode layout. Unlock positions remain scoped to the active native layout.

A party or raid draft contains a roster source and one member template under **ForEach**. Add visuals inside that template, using **$unit** in sources and **$pet** for its pet. The runtime derives members from the roster and retains unchanged Cells by GUID. An optional second template represents party pets.

A spell-list draft contains a ForEach with one button/icon template. In **Data > List helper**, use expressions such as `KnownSpells("Holy Light", "Seal*", /^Blessing of .*/i)`. Choose **Current item** as the template's action, icon or text source. Stable spell keys are automatic.

Tools, hierarchy entries and common controls share editable SVG glyphs from `addons/core/assets/icons/svg`. The build converts them to transparent native TGA textures and includes them in the core addon; feature addons use `LumaUI.Theme.icons`. Run `npm run icons:preview` to inspect the set.

Development is managed from the monorepo root: `npm ci`, `npm run check`, `npm run build`, `npm test`, and `npm run test:integration`. Run `npm run deploy` to install the addons into the configured local game directory.
