local master,editor=__wuiraModules_LumaUI,__wuiraModules_LumaUI_Editor
SettingsPanel=CreateFrame('Frame',nil,UIParent)
Settings={RegisterCanvasLayoutCategory=function() return {GetID=function() return 9 end} end,RegisterAddOnCategory=function() end}
Minimap=CreateFrame('Frame',nil,UIParent);Minimap:SetSize(140,140)
C_AddOns={IsAddOnLoaded=function() return true,true end}
LumaUISettings={};master.require('index')
local draft
local Draft=editor.require('Draft').EditorDraft
local construct=Draft.prototype.____constructor
Draft.prototype.____constructor=function(self,...) construct(self,...);draft=self end
local preview
local originalPreview=LumaUI.Presets.Preview
LumaUI.Presets.Preview=function(self,document) local result=originalPreview(self,document);preview=result;return result end
editor.require('index')
local function tick()
 local count=#nativeFrames
 for index=1,count do local f=nativeFrames[index];if f:IsVisible() and f.onUpdate then f.onUpdate(f,.05) end end
end
local function visible(text)
 for index=#nativeFrames,1,-1 do local f=nativeFrames[index];if f.fontString and f.fontString.text==text and f:IsVisible() then return f end end
end
local function click(text)
 local label=assert(visible(text),'missing visible control '..text)
 local parent=label
 while parent and parent~=UIParent do if parent.kind=='Button' and parent.scripts and parent.scripts.OnClick then parent.scripts.OnClick(parent);return end;parent=parent.parent end
 error('not a button: '..text)
end
local function input(text)
 for index=#nativeFrames,1,-1 do local f=nativeFrames[index];if f.kind=='EditBox' and f:IsVisible() and f.text==text then return f end end
 error('missing input '..text)
end
local sources,children={},{}
for row=1,5 do
 local buttons={}
 for column=1,2 do
  local id='button-'..row..'-'..column;local spell=20271+row*2+column
  sources[#sources+1]={name=id,type='spell',props={spellId=spell}}
  buttons[#buttons+1]={id=id,type='secureButton',source=id,props={width=24,height=24},children={{id=id..'-icon',type='icon',source=id,props={width='inherit',height='inherit'}}}}
 end
 children[#children+1]={id='row-'..row,type='flow',props={width='inherit',height=24,direction='horizontal'},children=buttons}
end
local document={version=1,kind='preset',id='ux-workspace',name='My action buttons',sources=sources,root={id='root',type='flow',props={width=220,height=140},children=children}}
LumaUI.Presets:Save(document,false)
LumaUI:OpenCustomization('library');assert(visible('CUSTOMIZE'),'library has navigation')
LumaUI:EditPreset(document)
assert(visible('LumaUI / Editor') and visible('Back') and not visible('CUSTOMIZE'),'editor hides config navigation')
local title=assert(visible('Visual Editor'));assert(title.parent.width==1096,'editor receives full config content width')
assert(visible('Save') and not visible('Apply') and not visible('Import') and not visible('Export') and not visible('New v'),'editor only edits and saves')
assert(#draft:VisibleTree()<#draft:Tree(),'presentation children start folded')

-- Header is a name label, renamed in place rather than a component selector.
assert(visible(document.name) and not visible(document.name..' v'),'header uses a plain component name')
local function doubleClick(text)
 for index=#nativeFrames,1,-1 do
  local frame=nativeFrames[index]
  if frame.fontString and frame.fontString.text==text and frame:IsVisible() then
   while frame and frame~=UIParent do
    if frame.scripts and frame.scripts.OnDoubleClick then frame.scripts.OnDoubleClick(frame,'LeftButton');return end
    frame=frame.parent
   end
  end
 end
 error('missing double click handler for '..text)
end
local function typeText(box,value)
 box:SetText(value)
end
LumaUI.Presets:Save({version=1,kind='preset',id='ux-parent',name='Parent component',sources={},root={id='dependency',type='preset',preset=document.id,props={}}},false)
LumaUI.Presets:SetBinding(document.id,'button-1-1','CTRL-U')
doubleClick(document.name);tick()
local rename=input(document.name);assert(rename.focused and rename.highlighted,'double click focuses and selects the component name')
typeText(rename,'   ');rename.scripts.OnEnterPressed(rename);tick()
assert(draft.renaming and draft.documentName==document.name and LumaUI.Presets:Get(document.id).name==document.name,'empty names leave the saved component intact')
input('   ').scripts.OnEscapePressed(input('   '));tick()
assert(not draft.renaming and visible(document.name),'Escape cancels renaming')
doubleClick(document.name);tick()
rename=input(document.name);typeText(rename,'  Renamed action buttons  ');rename.scripts.OnEnterPressed(rename);tick()
assert(draft.documentName=='Renamed action buttons' and draft.dirty and LumaUI.Presets:Get(document.id).name==document.name,'Enter stages a trimmed name until Save')
click('Save');tick()
assert(LumaUI.Presets:Get(document.id).name=='Renamed action buttons' and LumaUI.Presets:Get('ux-parent').root.preset==document.id and LumaUI.Presets:GetBinding(document.id,'button-1-1')=='CTRL-U','rename preserves component identity, references and character bindings')
doubleClick('Renamed action buttons');tick();typeText(input('Renamed action buttons'),'Final action buttons');click('Save');tick()
assert(not draft.renaming and LumaUI.Presets:Get(document.id).name=='Final action buttons','Save also commits a focused name input')

local count=#draft.nodes
click('Expand all');tick();assert(#draft:VisibleTree()==#draft:Tree() and #draft.nodes==count,'expanding changes view state only')
click('Collapse all');tick();assert(#draft:VisibleTree()==6,'collapse keeps root and its direct rows')
draft:Select('button-1-1-icon');tick()
assert(draft.selected=='button-1-1-icon' and #draft:Path()==4,'selecting a descendant reveals its entire path')
assert(not draft.collapsed:has('row-1') and not draft.collapsed:has('button-1-1'))
draft:ToggleExpanded('row-1');tick();assert(draft.selected=='row-1','collapsing selected descendants selects their visible ancestor')
click('Expand all');tick()
local viewport
for index=#nativeFrames,1,-1 do local f=nativeFrames[index];if f.kind=='ScrollFrame' and f:IsVisible() and f.onUpdate then viewport=f;break end end
assert(viewport and viewport:GetVerticalScrollRange()>0 and not visible('^'),'tree uses native scrolling without pager controls')
viewport.scripts.OnMouseWheel(viewport,-1);assert(draft.treeScroll==32)
draft:Select('button-5-2-icon');tick();assert(draft.treeScroll>32,'deep selections scroll into view')
click('Preview');tick()
assert(draft.workspaceView=='preview' and not visible('HIERARCHY · '..#draft:VisibleTree()..' / '..#draft.nodes) and not visible('Width'),'preview can use the entire workspace')
local target=preview.Nodes:get('button-1-1');assert(target.kind=='Frame' and not target.attributes,'preview stays unprotected')
local picker
for index=#nativeFrames,1,-1 do local f=nativeFrames[index];if f.parent==target and f.kind=='Button' and f.scripts.OnClick then picker=f;break end end
assert(picker and picker.template==nil,'preview hit target has no secure template')
local old=preview
picker.scripts.OnClick(picker);assert(draft.selected=='button-1-1' and preview==old,'preview selection waits until its native click returns')
tick();assert(old.Nodes.size==0 and picker.scripts.OnClick==nil and not picker.shown,'preview replacement releases selection overlays')
click('Inspector');tick();assert(visible('Properties') and visible('Width'),'inspector focus shows selected settings')
local presentation=editor.require('NodePresentation').describeNode(nil,draft,draft.Selected)
assert(presentation.title=='Spell 20274' and presentation.texture==20274,'known spell identity and icon replace technical IDs')
click('Design');tick();draft:Select('root');tick()
input('220'):SetText('247');click('Save');tick()
assert(LumaUI.Presets:Get(document.id).root.props.width==247 and not draft.dirty,'one Save commits typed props and the live component')
input('247'):SetText('-5');click('Save');tick()
assert(LumaUI.Presets:Get(document.id).root.props.width==247,'invalid typed props cannot overwrite a saved component')
draft.propertyEditor:Open();draft.propertyEditor:Set('width','220');click('Save');tick()
assert(LumaUI.Presets:Get(document.id).root.props.width==220)
click('Visuals');tick();assert(visible('Bar') and not visible('Add element v'),'tools are visible buttons rather than a component dropdown')
click('Bar');tick();assert(draft.Selected.kind=='progress')
local source=draft.sourceEditor
source:Open();source:Type('mana');source.name='ux.mana';source.values.unit='player';source.inputs:clear()
click('Save');tick();assert(LumaUI.Presets:Get(document.id).sources[#LumaUI.Presets:Get(document.id).sources].name=='ux.mana','Save includes pending source edits')
draft:BindSource('ux.mana','source');tick()
draft.propertyEditor:Ensure();draft.propertyEditor.bindingPath='progress';draft.propertyEditor.inputs:clear();click('Save');tick()
local bar=draft.selected
local saved=LumaUI.Presets:Get(document.id)
local function find(node,id) if node.id==id then return node end for _,child in ipairs(node.children or {}) do local result=find(child,id);if result then return result end end end
assert(find(saved.root,bar).sourcePath=='progress','one Save includes a pending source path')
draft.propertyEditor.bindingPath='missing.path';draft.propertyEditor.values.width='205';draft.propertyEditor.inputs:clear();click('Save');tick()
assert(find(LumaUI.Presets:Get(document.id).root,bar).sourcePath=='progress' and draft.Selected.sourcePath=='progress' and draft.Selected.props.width==180,'invalid source paths cannot partially apply property edits')
draft.propertyEditor:Open();draft:SetWorkspace('design');tick()
input('180'):SetText('207');click('Back')
assert(find(LumaUI.Presets:Get(document.id).root,bar).props.width==180,'Back keeps typed changes in the draft without saving the live component')
click('Visual Editor');assert(input('207'),'returning to the editor retains unfinished text input')
click('Save');tick();assert(find(LumaUI.Presets:Get(document.id).root,bar).props.width==207,'retained typed input can be saved after returning')
click('Back');assert(visible('CUSTOMIZE') and visible('New spell list'),'Back returns to the library and its create actions')
source:Open('ux.mana');source.values.unit='target';source.inputs:clear()
click('New spell list');assert(draft.documentId=='collection-1' and draft.nodes[1].kind=='foreach' and visible('LumaUI / Editor'),'library creates a fresh editor draft')
assert(not LumaUI.Presets:Get('collection-1'),'creating a draft does not install it')
assert(not draft.sourceEditor.HasChanges and #draft.sources==0,'a new component cannot inherit an unfinished source form')
click('Save');tick();assert(LumaUI.Presets:Get('collection-1').root.type=='foreach','one Save installs an explicitly created component')
draft.propertyEditor:Ensure();draft.propertyEditor.itemsExpression='KnownSpells("Seal*")';draft.propertyEditor.inputs:clear();click('Save');tick()
assert(LumaUI.Presets:Get('collection-1').root.items=='KnownSpells("Seal*")','one Save commits a typed list expression')
local gap=draft.Selected.props.gap
draft.propertyEditor.itemsExpression='Unknown("x")';draft.propertyEditor.values.gap='13';draft.propertyEditor.inputs:clear();click('Save');tick()
assert(LumaUI.Presets:Get('collection-1').root.items=='KnownSpells("Seal*")' and draft.Selected.items=='KnownSpells("Seal*")' and draft.Selected.props.gap==gap,'invalid list expressions cannot partially replace saved props or bindings')


-- The component ribbon shows only what fits, and filters locally without replacing its input.
for index=1,12 do LumaUI.Presets:Save({version=1,kind='preset',id='ribbon-'..index,name='Template '..index,sources={},root={id='root',type='cell',props={width=40,height=20}}},false) end
local special={version=1,kind='preset',id='ribbon-special',name='Unique [example]',sources={},root={id='root',type='cell',props={width=40,height=20}}}
LumaUI.Presets:Save(special,false)
draft:Load({version=1,kind='preset',id='ribbon-host',name='Ribbon host',sources={},root={id='root',type='flow',props={width=200,height=100}}});tick()
click('Components');tick()
assert(not visible('Add component v') and not visible('Ribbon host v'),'component selectors are removed')
local function searchInput()
 for index=#nativeFrames,1,-1 do local f=nativeFrames[index];if f.kind=='EditBox' and f:IsVisible() and f.maxBytes==128 and f.scripts.OnTextChanged then return f end end
 error('missing component search input')
end
local filter=searchInput()
local shown=0
for _,doc in ipairs(LumaUI.Presets:List()) do if visible(doc.name) and doc.id~='ribbon-host' then shown=shown+1 end end
assert(shown>1 and shown<#LumaUI.Presets:List(),'the ribbon displays as many component buttons as fit')
filter:SetFocus();typeText(filter,'[EXAMPLE]')
assert(input('[EXAMPLE]')==filter and filter.focused and visible(special.name),'literal case-insensitive filtering retains the input and focus')
assert(not visible('Template 1') and visible('1/1'),'the matching component can be found outside the initial visible set')
click(special.name);tick()
assert(draft.Selected.kind=='preset' and draft.Selected.preset==special.id,'a filtered component inserts a shared reference')
filter=input('[EXAMPLE]');typeText(filter,'not found')
assert(visible('No matching components') and input('not found')==filter,'no-match feedback keeps the same native input')
typeText(filter,special.id);assert(visible(special.name),'stable IDs are searchable too')
filter.scripts.OnEscapePressed(filter);assert(searchInput()==filter and draft.componentFilter=='','Escape clears the filter')
for _,choice in ipairs(editor.require('ElementCatalog').elementChoices(nil)) do
 local name=editor.require('Glyph').elementIcon(nil,choice.value)
 assert(LumaUI.Theme.icons[name],'every registered element has a native SVG glyph: '..choice.value)
end
draft:StartRename();tick();typeText(input('Ribbon host'),'Unsaved ribbon name')
draft:Load(special);tick()
assert(not draft.renaming and draft.documentName==special.name,'switching components clears the name edit state')

print('Editor usability: full workspace, Back, toolbox, focus views, folds, native scrolling, preview selection and one Save passed')
