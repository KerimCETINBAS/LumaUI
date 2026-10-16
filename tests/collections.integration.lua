
function IsShiftKeyDown() return false end
function IsControlKeyDown() return false end
function IsAltKeyDown() return false end
SlashCmdList={}
SettingsPanel=CreateFrame('Frame',nil,UIParent)
Settings={RegisterCanvasLayoutCategory=function() return {GetID=function() return 9 end} end,RegisterAddOnCategory=function() end}
Minimap=CreateFrame('Frame',nil,UIParent);Minimap:SetSize(140,140)
C_AddOns={IsAddOnLoaded=function(name) local loaded=name~='LumaUI_ActionBars';return loaded,loaded end}
local knownIDs={20271,679,26573,20216,21084,19740,999999}
Enum.SpellBookSpellBank={Player=0};Enum.SpellBookItemType={Spell=1}
C_SpellBook={GetNumSpellBookSkillLines=function() return 1 end,GetSpellBookSkillLineInfo=function() return {itemIndexOffset=0,numSpellBookItems=#knownIDs} end,GetSpellBookItemInfo=function(slot) return {itemType=1,spellID=knownIDs[slot],isPassive=false} end}
local logs,originalPrint={},print
function print(value) logs[#logs+1]=tostring(value) end
local payloads={}
C_EncodingUtil={SerializeCBOR=function(v) payloads[#payloads+1]=v;return tostring(#payloads) end,DeserializeCBOR=function(v) return payloads[tonumber(v)] end,CompressString=function(v) return v end,DecompressString=function(v) return v end,EncodeBase64=function(v) return v end,DecodeBase64=function(v) return v end}
__LOAD_BUNDLES__
local master,editor=__wuiraModules_LumaUI,__wuiraModules_LumaUI_Editor
local controls
local controlsClass=master.require('builder.CollectionControls').CollectionControls
local constructControls=controlsClass.prototype.____constructor
controlsClass.prototype.____constructor=function(self,...) constructControls(self,...);controls=self end
local slotCaptures,slotClears,slotRestores=0,0,0
local function slotAPI() return {ActionBars={Capture=function() slotCaptures=slotCaptures+1;return {{slot=1,type='spell',id=635}} end,Clear=function(_,slots) assert(slots[1].id==635);slotClears=slotClears+1 end,Restore=function(_,slots) assert(slots[1].id==635);slotRestores=slotRestores+1 end,InstallEmptyMode=function() error('Global action bar suppression must not run') end}} end
master.factories['lua_modules.wuira.lib.platform.ActionBars']=slotAPI
LumaUISettings={['lumaui.settings']={version=3,playerPosition={x=11,y=22},actionPosition={x=-80,y=300},bindings={['679']='F'}}}
LumaUIActionBarBackup={preserved=true}
local nativeParent=CreateFrame('Frame',nil,UIParent)
PlayerFrame=CreateFrame('Frame',nil,nativeParent)
TargetFrame=CreateFrame('Frame',nil,UIParent);FocusFrame=CreateFrame('Frame',nil,UIParent)
MainActionBar=CreateFrame('Frame',nil,nativeParent)
MainActionBar:RegisterEvent('ACTIONBAR_SLOT_CHANGED')
local nativeBarEvent=function() end;MainActionBar:SetScript('OnEvent',nativeBarEvent)
ActionBarController=CreateFrame('Frame',nil,UIParent);ActionBarController:RegisterEvent('UPDATE_SHAPESHIFT_FORM')
local nativeControllerUpdate=function() end;ActionBarController:SetScript('OnUpdate',nativeControllerUpdate)
ActionButton1=CreateFrame('Button',nil,MainActionBar,'SecureActionButtonTemplate');ActionButton1:RegisterEvent('ACTIONBAR_SLOT_CHANGED')
local nativeButtonClick=function() end;ActionButton1:SetScript('OnClick',nativeButtonClick)
master.require('index')
assert(#LumaUI.Presets:List()==0 and #LumaUI.ClickCastPresets:List()==0,'startup never seeds saved UI or mappings')
-- Tests install the same wire assets as an explicitly confirmed import.
local function importBuiltin(core,registry,key)
 local transfer=new(registry.require('builder.PresetTransfer').PresetTransfer,core)
 local payload=transfer:Decode(assert(core.BuiltinPresets[key]),'preset')
 transfer:PrepareClickCast(payload)
 return payload.document
end

local importedPlayer=importBuiltin(LumaUI,master,'PlayerResources')
importedPlayer.root.props.x=11;importedPlayer.root.props.y=22
LumaUI.Presets:Save(importedPlayer,true)
for _,key in ipairs({'PaladinParty','PaladinRaid'}) do LumaUI.Presets:Save(importBuiltin(LumaUI,master,key),true) end
LumaUI.Presets:Restore()
assert(controls and controls.active:get('player'),'player mounts through common runtime')
assert(MainActionBar:GetParent()==nativeParent and slotCaptures==0,'master does not suppress or clear native action bars')
local player=LumaUI.Presets:Get('player')
assert(LumaUI.Presets:Get('hide-player-frame') and #LumaUI.Presets:UsedBy('hide-player-frame')==1,'headless starter is a separate dependency in the library')
assert(player.root.props.x==11 and player.root.props.y==22,'explicit imported player position')
local replacement=controls.active:get('player').instance.Frame
LumaUI.Presets:Unmount('player');LumaUI.Presets:Save(player,false)
assert(not replacement.shown and PlayerFrame:GetParent()==nativeParent,'library disable removes the replacement and restores native player')
LumaUI.Presets:Restore();assert(not controls.active:get('player') and PlayerFrame:GetParent()==nativeParent,'inactive collection stays inactive')
LumaUI.Presets:Mount(player);LumaUI.Presets:Save(player,true)
assert(PlayerFrame:GetParent()~=nativeParent and TargetFrame:GetParent()==UIParent and FocusFrame:GetParent()==UIParent,'only owned replacement hides its native frame')
player.root.props.width=240;LumaUI.Presets:Save(player,true);LumaUI.Presets:Mount(player)
LumaUI.Presets:Restore()
assert(LumaUI.Presets:Get('player').root.props.width==240,'saved components are not rewritten')
LumaUI:SetMode('unlock')
local mover=controls.movers:get('player')
mover.Frame.scripts.OnDragStart(mover.Frame)
mover.Frame:SetPoint('CENTER',UIParent,'CENTER',70,-430)
mover.Frame.scripts.OnDragStop(mover.Frame)
assert(LumaUI.Presets:Get('player').root.props.y==430,'drag saves collection coordinates')
LumaUI:SetMode('locked')
__ACTION_BUTTON_FIXTURE__
assert(LumaUI.BuiltinPresets.PaladinActionBars==nil and not LumaUI.Presets:Get('action-bars'),'startup has no retired action-bar generator')
local importedActions=testActionButtons()
assert(LumaUI.Presets:Validate(importedActions).owner==nil and importedActions.owner=='LumaUI_ActionBars','legacy owner is released without mutating the imported payload')
importedActions.root.props.x=-80;importedActions.root.props.y=300
LumaUI.Presets:Apply(importedActions)
LumaUI.Presets:SetBinding('action-bars','spell-679','F')
assert(controls.active:get('action-bars') and MainActionBar:GetParent()~=nativeParent,'optional collection owns native bar visibility')
assert(LumaUI.Presets:Get('hide-action-bars') and #LumaUI.Presets:UsedBy('hide-action-bars')==1,'native bar hiding is a separate headless dependency')
assert(MainActionBar.events.ACTIONBAR_SLOT_CHANGED and MainActionBar.onEvent==nativeBarEvent and ActionBarController.events.UPDATE_SHAPESHIFT_FORM and ActionBarController.onUpdate==nativeControllerUpdate and ActionButton1.scripts.OnClick==nativeButtonClick,'hiding preserves native events, updates and click scripts')
emit('PLAYER_ENTERING_WORLD');assert(slotCaptures==0 and slotClears==0 and slotRestores==0,'startup neither reads nor changes native action slots')
local function slash(alias)
 for key,value in pairs(_G) do if type(key)=='string' and key:match('^SLASH_') and value==alias then local id=key:sub(7,-2);return SlashCmdList[id] end end
 error('missing command '..alias)
end
slash('/lumarestorebars')('');assert(slotCaptures==0 and slotRestores==0,'missing backups do not read or restore native slots')
slash('/lumaclearbars')('');assert(slotCaptures==1 and slotClears==0,'first explicit clear captures a backup only')
slash('/lumaclearbars')('');assert(slotCaptures==1 and slotClears==0,'new backup must be persisted before clearing')
LumaUI.Presets:SetActivation('action-bars','never');assert(MainActionBar:GetParent()==nativeParent and not controls.active:get('action-bars'),'disabling the parent restores native bars')
local hideBars=LumaUI.Presets:Get('hide-action-bars')
local headlessPreview=LumaUI.Presets:Preview(hideBars);assert(headlessPreview.View==nil and MainActionBar:GetParent()==nativeParent,'headless preview cannot hide bars');headlessPreview:Dispose()
LumaUI.Presets:SetActivation('action-bars','condMet')
local otherHide=LumaUI.Presets:Mount(hideBars)
LumaUI.Presets:Unmount('action-bars');assert(MainActionBar:GetParent()~=nativeParent,'another collection still owns hiding')
LumaUI.Presets:Unmount('hide-action-bars');assert(MainActionBar:GetParent()==nativeParent,'last hiding owner restores native bars')
LumaUI.Presets:SetActivation('action-bars','condMet')
combat=true;LumaUI.Presets:Unmount('action-bars');assert(MainActionBar:GetParent()~=nativeParent,'protected parent cleanup waits in combat')
combat=false;emit('PLAYER_REGEN_ENABLED');assert(MainActionBar:GetParent()==nativeParent)
LumaUI.Presets:SetActivation('action-bars','condMet')
local shared=LumaUI.Presets:Import(LumaUI.Presets:Export(LumaUI.Presets:Get('action-bars')))
assert(#shared.dependencies==1 and shared.dependencies[1].id=='hide-action-bars','sharing includes the independent hide preset')
local hotbar=LumaUI.Presets:Get('action-bars')
assert(#controls.active:get('action-bars').instance.View.children==#hotbar.root.children-1,'headless child does not consume a flow row')
assert(hotbar.owner==nil and hotbar.root.props.x==-80 and hotbar.root.props.y==300,'retired ownership is removed while edited position is retained')
local function find(node,id)
 if node.id==id then return node end
 for _,child in ipairs(node.children or {}) do local result=find(child,id);if result then return result end end
end
assert(find(hotbar.root,'spell-679').props.binding==nil and LumaUI.Presets:GetBinding('action-bars','spell-679')=='F','assigned hotkey stays in independent settings')
assert(LumaUI.Presets:GetBinding('action-bars','spell-20271')==nil,'starter does not assign default keys')
controls:SetBinding('action-bars','spell-679','Q');controls:SetBinding('action-bars','spell-20271','Q')
hotbar=LumaUI.Presets:Get('action-bars')
assert(find(hotbar.root,'spell-20271').props.binding==nil and LumaUI.Presets:GetBinding('action-bars','spell-679')==nil and LumaUI.Presets:GetBinding('action-bars','spell-20271')=='Q','binding conflict updates character settings, not nodes')
controls:SetBinding('action-bars','spell-20271',nil)
hotbar=LumaUI.Presets:Get('action-bars');hotbar.root.props.width=260
LumaUI.Presets:Mount(hotbar);LumaUI.Presets:Save(hotbar,true)
LumaUI.Presets:Restore()
assert(LumaUI.Presets:Get('action-bars').root.props.width==260,'hotbar is not regenerated')
local draft
local draftClass=editor.require('Draft').EditorDraft
local constructDraft=draftClass.prototype.____constructor
draftClass.prototype.____constructor=function(self,...) constructDraft(self,...);draft=self end
local lastPreview
local originalPreview=LumaUI.Presets.Preview
LumaUI.Presets.Preview=function(self,document) lastPreview=originalPreview(self,document);return lastPreview end
local function tick()
 local count=#nativeFrames
 for i=1,count do local f=nativeFrames[i];if f.shown and f.onUpdate then f.onUpdate(f,.05) end end
end
local function editorWindow()
 for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.strata=='DIALOG' and f.movable and f.width==1160 and f.height==720 and f.shown then return f end end
 error('editor window closed')
end
editor.require('index')
LumaUI:EditPreset(LumaUI.Presets:Get('player'))
assert(draft.documentId=='player' and draft:Document().root.props.width==240)
assert(find(draft:Document().root,'castName').textSource=='cast' and find(draft:Document().root,'sealRow').visibleSource=='seal','editor keeps bindings')
local window=editorWindow()
assert(lastPreview and lastPreview.Nodes:get('healthBar').width==240,'preview uses inherited runtime dimensions')
assert(lastPreview.Nodes:get('healthBar').height==24 and lastPreview.Nodes:get('healthBar').y==-23,'preview uses actual flow placements')
assert(lastPreview.Nodes:get('manaRegenBar').anchor=='BOTTOMLEFT','preview keeps nested anchors')
assert(lastPreview.Nodes:get('playerPortrait').kind=='Frame' and lastPreview.Nodes:get('playerPortrait').texture.portraitUnit=='player','portrait preview draws the unit without a secure button')
local widthLabel,heightLabel,legacyPager=false,false,false
for _,frame in ipairs(nativeFrames) do if frame.fontString and frame.shown then
 local text=frame.fontString.text or '';if text=='Width' then widthLabel=true elseif text=='Height' then heightLabel=true end
 if text:match('^Property %d') or text:match('^Field %d') then legacyPager=true end
end end
assert(widthLabel and heightLabel and not legacyPager,'related settings have visible labels without property paging')
local form=draft.propertyEditor
local widthInput
for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.kind=='EditBox' and f.shown and f.text=='240' then widthInput=f;break end end
assert(widthInput,'width input is visible in Display');widthInput:SetText('250')
local stepper=widthInput.parent.parent
for _,frame in ipairs(nativeFrames) do if frame.parent==stepper and frame.kind=='Button' and frame.scripts and frame.scripts.OnClick then
 local plus=false;for _,child in ipairs(nativeFrames) do if child.parent==frame and child.fontString and child.fontString.text=='+' then plus=true end end
 if plus then frame.scripts.OnClick(frame);break end
end end
tick();assert(form.values.width=='251','stepper uses the latest typed value')
form:Set('width','240');form:Save();tick()
local function hierarchyViewport()
 for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.kind=='ScrollFrame' and f.width==244 and f.shown and f.scrollChild and f.scrollChild.shown then return f end end
 error('missing hierarchy viewport')
end
local function hierarchyRow(id)
 local node=draft.nodes[1];for _,entry in ipairs(draft.nodes) do if entry.id==id then node=entry;break end end
 local name=editor.require('NodePresentation').describeNode(nil,draft,node).title
 for i=#nativeFrames,1,-1 do
  local f=nativeFrames[i]
  if f.fontString and f.fontString.text==name then
   local p=f.parent
   while p and p~=UIParent do if p.shown and p.scripts and p.scripts.OnDragStart then return p end;p=p.parent end
  end
 end
 error('missing hierarchy row '..name)
end
draft:ExpandAll(true);tick()
local viewport=hierarchyViewport()
assert(viewport:GetVerticalScrollRange()>0,'hierarchy contains every row in a native scroll viewport')
assert(hierarchyRow('castName'),'rows beyond the first eight exist without pagination')
viewport.scripts.OnMouseWheel(viewport,-2)
assert(draft.treeScroll==64 and viewport:GetVerticalScroll()==64,'mouse wheel scrolls the tree')
local function drag(sourceName,targetName,anchor)
 local row=hierarchyRow(sourceName);local target=hierarchyRow(targetName);local region
 for _,f in ipairs(nativeFrames) do if f.parent==target and f.anchor==anchor and f.kind=='Frame' and f.height==(anchor=='LEFT' and 18 or 6) then region=f;break end end
 assert(region,'drop region exists')
 hierarchyViewport().mouseOver=true;region.mouseOver=true
 row.scripts.OnDragStart(row);tick();row.scripts.OnDragStop(row);tick()
 region.mouseOver=false;hierarchyViewport().mouseOver=false
end
drag('manaBar','healthBar','TOPLEFT')
local children=draft:Children('resources');local healthIndex,manaIndex
for i,node in ipairs(children) do if node.id=='healthBar' then healthIndex=i elseif node.id=='manaBar' then manaIndex=i end end
assert(manaIndex+1==healthIndex,'native drag reorders sibling elements')
assert(hierarchyViewport():GetVerticalScroll()==64,'selection and reordering preserve scroll offset')
draft:MoveNode('manaBar','healthBar','after');tick()
drag('castName','sealBar','LEFT')
assert(draft:Children('sealBar')[1].id=='castName','native drag can reparent into an available container')
assert(draft:DropError('castName','healthBar','inside')~=nil,'portrait occupies the health bar presentation child')
assert(draft:DropError('resources','healthBar','inside')~=nil,'descendant cycles are rejected')
assert(draft:DropError('player','resources','inside')~=nil,'root cannot be dragged')
assert(draft:DropError('sealIcon','manaBar','inside')~=nil,'single-child containers cannot be overfilled')
draft:MoveNode('castName','castBar','inside');draft:Select('player');tick()
local beforeInvalid=draft:Document().root.children[1].children[1].id
draft:MoveNode('resources','healthBar','inside');tick()
assert(draft:Document().root.children[1].children[1].id==beforeInvalid,'invalid drop preserves the tree')
local previousPreview=lastPreview
local beforeClick=#nativeFrames
local clicked=false
for i=#nativeFrames,1,-1 do
 local f=nativeFrames[i]
 if f.fontString and f.fontString.text==editor.require('NodePresentation').describeNode(nil,draft,(function() for _,node in ipairs(draft.nodes) do if node.id=='healthBar' then return node end end end)()).title then
  local parent=f.parent
  while parent and parent~=UIParent do
   if parent.shown and parent.scripts and parent.scripts.OnClick then parent.scripts.OnClick(parent);clicked=true;break end
   parent=parent.parent
  end
  if clicked then break end
 end
end
assert(clicked and draft.selected=='healthBar','native hierarchy click selects the node')
assert(#nativeFrames==beforeClick and lastPreview==previousPreview,'replacement is deferred until the click returns')
tick()
assert(editorWindow()==window and lastPreview~=previousPreview and previousPreview.Nodes.size==0,'replaced preview releases all nodes: '..table.concat(logs,' | '))
local rootPreview=lastPreview.Nodes:get('player')
assert(rootPreview.relative~=UIParent and rootPreview.x==0 and rootPreview.y==0 and rootPreview.anchor=='CENTER','preview is centered without screen offsets')
assert(rootPreview:GetScale()==1 and rootPreview.width==240 and rootPreview.height==85,'preview uses the actual dimensions without scaling')
assert(lastPreview.Nodes:get('sealRow').shown and lastPreview.Nodes:get('sealIcon').texture.path==21084,'inactive aura keeps a spell icon in the preview')
assert(lastPreview.Nodes:get('sealBar').value==65,'inactive timer uses sample progress')
assert(lastPreview.Nodes:get('castName').fontString.text=='Sample text','inactive dynamic text remains visible for editing')
assert(draft:Document().root.props.x==70 and draft:Document().root.props.y==430,'preview centering does not change saved position')
for pass=1,3 do
 for _,node in ipairs(draft.nodes) do
  draft:Select(node.id)
  assert(editorWindow()==window,'selection does not close or replace the host')
  tick()
  assert(editorWindow()==window and (not draft:IsVisual(node) or lastPreview.Nodes:get(node.id)),'all hierarchy nodes remain navigable')
 end
end
draft:Select('player');tick()
LumaUI:CloseCustomization();LumaUI:OpenCustomization('editor')
assert(editorWindow().shown,'editor can reopen without reload')
draft:Resize('width',10);draft:Apply();tick()
assert(LumaUI.Presets:Get('player').root.props.width==250,'Apply saves and mounts')
local function latestInput()
 for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.kind=='EditBox' and f.shown then return f end end
 error('missing input')
end
draft:Export()
local input=latestInput();local encoded=input.text
assert(encoded:sub(1,8)=='!LUMA:1!' and input.focused and input.highlighted,'single share string')
input.scripts.OnEscapePressed(input);assert(not input.focused and not input.shown,'text cleanup')
draft:Import();input=latestInput();input:SetText(encoded)
local function click(text)
 for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.fontString and f.fontString.text==text then
  local p=f.parent;while p and p~=UIParent do if p.kind=='Button' and p.shown and p.scripts and p.scripts.OnClick then p.scripts.OnClick(p);return end;p=p.parent end
 end end
 error('missing control '..text)
end
click('Import');tick()
assert(draft.documentId=='player' and draft:Document().root.props.width==250,'editor import')
LumaUI:EditPreset(LumaUI.Presets:Get('action-bars'))
assert(draft:Document().owner==nil and find(draft:Document().root,'spell-20216').alphaSource=='pending-20216','editor keeps the aura binding without a retired addon owner')
tick()
assert(lastPreview.Nodes:get('spell-20216').kind=='Frame','action preview has no secure button template')
draft:New();draft:Add('progress');draft:UseResource('mana');draft:Apply();tick()
assert(draft.documentId=='collection-1' and LumaUI.Presets:Get('collection-1') and LumaUI.Presets:Get('player').root.props.width==250,'new independent collection')
-- The source form stages changes, and the component inspector owns the binding.
click('Sources');tick()
assert(draft.sourceEditor.original=='player.mana','selected element source appears in the source inspector')
local sourceForm=draft.sourceEditor
local unitInput=latestInput();assert(unitInput.text=='player')
unitInput:SetText('');click('Update source');tick()
assert(draft.sources[1].props.unit==nil,'source properties can be edited through native text entry')
click('New source');tick()
local nameInput
for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.kind=='EditBox' and f.shown and f.text=='source-1' then nameInput=f;break end end
assert(nameInput,'new source has a name input');nameInput:SetText('custom.hp');latestInput():SetText('player')
click('Update source');tick()
assert(sourceForm.original=='custom.hp' and #draft.sources==2,'new source is created and validated')
click('Properties');tick();click('Data');tick()
click('player.mana v');click('custom.hp');tick()
assert(draft.Selected.source=='custom.hp','source dropdown binds the selected element: '..tostring(draft.Selected.source)..' / '..draft.message)
local propForm=draft.propertyEditor
propForm.values.width='200';propForm.inputs:clear();propForm:Save();tick()
local widthPreview=lastPreview.Nodes:get(draft.selected)
local previewFailures={};for _,frame in ipairs(nativeFrames) do local value=frame.fontString and frame.fontString.text;if type(value)=='string' and value:sub(1,9)=='Preview: ' and frame.shown then previewFailures[#previewFailures+1]=value end end
assert(draft.Selected.props.width==200 and widthPreview and widthPreview.width==200,'property inspector edits width at actual size: '..tostring(draft.selected)..' / '..draft.message..' / '..table.concat(previewFailures,' | ')..' / '..table.concat(logs,' | '))
propForm.values.width='-10';propForm.inputs:clear();propForm:Save();tick()
assert(draft.Selected.props.width==200,'invalid property does not replace the working value')
propForm:Open();propForm.values['foreground.color.r']='0.2';propForm.values['foreground.color.g']='0.3';propForm.values['foreground.color.b']='0.4';propForm.inputs:clear();propForm:Save();tick()
assert(draft.Selected.props.foreground.color.g==.3,'nested appearance properties are editable')
sourceForm:Open('player.mana');sourceForm.values.regenTimer='true';sourceForm.inputs:clear();sourceForm:Save();tick()
propForm:Open();propForm.bindingPath='channels.regen';propForm.inputs:clear();propForm:Bind('player.mana');tick()
assert(draft.Selected.source=='player.mana' and draft.Selected.sourcePath=='channels.regen','nested source path binds the mana timer')
assert(draft:Document().root.children[1].sourcePath=='channels.regen','source path is serialized')
propForm.bindingPath='channels.missing';propForm.inputs:clear();propForm:Bind('player.mana');tick()
assert(draft.Selected.sourcePath=='channels.regen','invalid path preserves the old binding')
local beforeDelete=#draft.sources
sourceForm:Open('player.mana');sourceForm:Delete();tick()
assert(#draft.sources==beforeDelete and draft.Selected.source=='player.mana','a referenced source cannot be removed')
local fields=propForm:Fields(true);local seen={};for _,field in ipairs(fields) do seen[field.path[1]]=true end
for key in pairs(LumaUI.Presets:ComponentProperties('progress')) do assert(seen[key],'registered property missing from inspector: '..key) end
assert(LumaUI.Presets:ComponentProperties('flow').sizing and LumaUI.Presets:ComponentProperties('grid').cellWidth,'layout-specific properties are exposed')
sourceForm:Open('custom.hp');sourceForm:Delete();tick()
assert(#draft.sources==1,'unused sources can be deleted')
local rules=LumaUI.Presets:SourceProperties('mana');rules.regenTimer.type='string'
assert(LumaUI.Presets:SourceProperties('mana').regenTimer.type=='boolean','inspector schemas are detached')
draft:Apply();tick()
assert(LumaUI.Presets:Get('collection-1').root.children[1].sourcePath=='channels.regen','Apply persists source paths')
-- Create a headless component from UI Library, then reuse it in an existing Cell.
LumaUI:OpenCustomization('library');click('New headless');tick()
assert(draft.documentId=='collection-2' and draft.nodes[1].kind=='fragment' and lastPreview.View==nil,'headless drafts have no fake frame')
click('Effects');tick();click('Hide unit');tick()
assert(draft.Selected.kind=='hideUnitFrame' and draft.Selected.props.unit=='player' and lastPreview.View==nil,'headless effect is editable and preview remains empty')
local headlessForm=draft.propertyEditor
headlessForm:Set('unit','target');headlessForm:Save();tick()
assert(draft.Selected.props.unit=='target','headless properties are editable')
draft:Apply();tick()
assert(LumaUI.Presets:Get('collection-2') and controls.active:get('collection-2').instance.Frame==nil,'headless preset applies without a visual frame')
LumaUI:EditPreset(LumaUI.Presets:Get('player'));tick()
click('Components');tick();click('Component 2');tick()
assert(draft.Selected.kind=='preset' and draft.Selected.preset=='collection-2','component ribbon inserts a shared preset reference')
assert((not lastPreview.View.children or #lastPreview.View.children==0) and lastPreview.View.child~=nil,'headless dependency does not consume the Cell visual child slot')
draft:Apply();tick()
assert(#LumaUI.Presets:UsedBy('collection-2')==1 and LumaUI.Presets:Get('player').dependencies==nil,'nested preset remains a separate library item')
local bundled=LumaUI.Presets:Export(LumaUI.Presets:Get('player'))
local composed=LumaUI.Presets:Import(bundled)
assert(#composed.dependencies==2 and LumaUI.Presets:IsHeadless(composed.dependencies[1]),'one string includes both independent headless dependencies')
assert(not pcall(function() LumaUI.Presets:Delete('collection-2') end),'library protects referenced presets')
LumaUI.Presets:Unmount('collection-2')
assert(controls.active:get('player'),'disabling standalone child does not disable its parent')
LumaUI:EditPreset(LumaUI.Presets:Get('collection-1'));tick()
assert(LumaUIActionBarBackup.preserved,'native action backup remains intact')
combat=true
assert(not pcall(function() LumaUI.Presets:Mount(draft:Document()) end))
emit('PLAYER_REGEN_DISABLED');assert(controls.mode=='locked')
combat=false;emit('PLAYER_REGEN_ENABLED')
-- Native layouts scope activation, editor metadata and unlock geometry.
do
 local native={activeLayout=1,layouts={{layoutName='Solo',layoutType=1},{layoutName='Raid',layoutType=1}}}
 C_EditMode={GetLayouts=function() return native end}
 emit('EDIT_MODE_LAYOUTS_UPDATED');tick()
 LumaUI:EditPreset(LumaUI.Presets:Get('collection-1'));tick()
 draft:SetInspector('collection');tick()
 click('Any layout v');click('Raid [1]');tick()
 assert(draft.nativeLayout=='1::Raid' and draft:Document().layout=='1::Raid','native layout is chosen in the collection inspector')
 draft:UpdateActivation({enabled='condMet',class='PALADIN',condition='inParty'});tick()
 draft:Save();local activeDraft=draft;local restored=new(draftClass);draft=activeDraft
 assert(restored.nativeLayout=='1::Raid' and restored.collectionClass=='PALADIN' and restored.collectionCondition=='inParty','draft activation metadata persists')
 draft:UpdateActivation({enabled='condMet',class='',condition=''});draft:Apply();tick()
 assert(not controls.active:get('collection-1'),'mismatching layout does not mount')
 native.activeLayout=2;emit('EDIT_MODE_LAYOUTS_UPDATED');tick()
 assert(controls.active:get('collection-1'),'game layout change activates the selected collection')
 draft:UpdateActivation({layout=''});draft:Apply();tick()
 LumaUI:SetMode('unlock')
 local mover=controls.movers:get('collection-1')
 mover.Frame.scripts.OnDragStart(mover.Frame);mover.Frame:SetPoint('CENTER',UIParent,'CENTER',44,-88);mover.Frame.scripts.OnDragStop(mover.Frame)
 assert(LumaUI.Presets:Get('collection-1').layoutPositions['1::Raid'].y==88,'unlock writes to the active native layout key')
 native.activeLayout=1;emit('EDIT_MODE_LAYOUTS_UPDATED');tick()
 mover=controls.movers:get('collection-1')
 mover.Frame.scripts.OnDragStart(mover.Frame);mover.Frame:SetPoint('CENTER',UIParent,'CENTER',22,-33);mover.Frame.scripts.OnDragStop(mover.Frame)
 native.activeLayout=2;emit('EDIT_MODE_LAYOUTS_UPDATED');tick()
 assert(controls.active:get('collection-1').instance.View.props.x==44,'unlock restores another layout position')
 local roundtrip=LumaUI.Presets:Import(LumaUI.Presets:Export(LumaUI.Presets:Get('collection-1')))
 assert(roundtrip.layoutPositions['1::Solo'].y==33 and roundtrip.layoutPositions['1::Raid'].y==88,'share string includes per-layout positions')
 LumaUI.Presets:SetActivation('collection-1','never');assert(not controls.active:get('collection-1'))
 LumaUI.Presets:SetActivation('collection-1','condMet');assert(controls.active:get('collection-1'))
 C_EditMode=nil;emit('EDIT_MODE_LAYOUTS_UPDATED');tick()
end
LumaUI:EditPreset(LumaUI.Presets:Get('hide-action-bars'));tick()
assert(draft.nodes[1].kind=='hideActionBars','editor root kind: '..tostring(draft.nodes[1].kind))
assert(not draft:IsVisual(draft.nodes[1]),'headless effect is not visual')
assert(lastPreview.View==nil,'headless preview view must be empty')
assert(draft:Document().root.props.width==nil,'headless root has no width')
controls:SetBinding('action-bars','spell-679','CTRL-K')
LumaUI:SetMode('locked');LumaUI:CloseCustomization()
for _,document in ipairs(LumaUI.Presets:List()) do LumaUI.Presets:Unmount(document.id) end
for _,document in ipairs(LumaUI.Skins:List()) do LumaUI.Skins:Remove(document.id) end
-- Simulate an untouched pre-removal saved component on the next login.
for _,document in ipairs(LumaUISettings['lumaui.builder'].documents) do if document.id=='action-bars' then document.owner='LumaUI_ActionBars' end end
nativeFrames={};frames={};SlashCmdList={}
for key in pairs(_G) do if type(key)=='string' and key:sub(1,6)=='SLASH_' then _G[key]=nil end end
__LOAD_BUNDLES__
master=__wuiraModules_LumaUI
master.factories['lua_modules.wuira.lib.platform.ActionBars']=slotAPI
controlsClass=master.require('builder.CollectionControls').CollectionControls
constructControls=controlsClass.prototype.____constructor
controlsClass.prototype.____constructor=function(self,...) constructControls(self,...);controls=self end
master.require('index')
assert(controls.active:get('player') and controls.active:get('action-bars') and MainActionBar:GetParent()~=nativeParent,'core restores saved action components without the retired addon')
assert(LumaUI.Presets:Get('action-bars').owner==nil,'reload persists the retired-owner cleanup')
assert(LumaUI.Presets:Get('player').root.props.width==250 and LumaUI.Presets:Get('action-bars').root.props.width==260,'reload preserves layouts')
assert(LumaUI.Presets:Get('action-bars').root.props.width==260 and MainActionBar:GetParent()~=nativeParent,'saved geometry and owned hiding survive addon removal')
assert(LumaUI.Presets:GetBinding('action-bars','spell-679')=='CTRL-K' and bindingTarget('CTRL-K')==controls.active:get('action-bars').instance.Nodes:get('spell-679'),'reload restores independent character bindings onto the new button')
emit('PLAYER_ENTERING_WORLD');assert(slotCaptures==1,'existing persisted backups are reused')
slash('/lumaclearbars')('');assert(slotClears==1 and LumaUIActionBarBackup['wuira.native-action-bars'].phase=='disabled')
combat=true;slash('/lumarestorebars')('');assert(slotRestores==0,'combat blocks native slot mutation');combat=false
slash('/lumarestorebars')('');assert(slotRestores==1 and LumaUIActionBarBackup['wuira.native-action-bars'].phase=='restored' and MainActionBar:GetParent()~=nativeParent,'manual slot restore does not change collection visibility')
LumaUI.Presets:SetActivation('action-bars','never');assert(MainActionBar:GetParent()==nativeParent)
assert(MainActionBar.events.ACTIONBAR_SLOT_CHANGED and MainActionBar.onEvent==nativeBarEvent and ActionButton1.scripts.OnClick==nativeButtonClick,'restored native bars retain their original handlers')
LumaUI.Presets:SetActivation('action-bars','condMet')
__BINDING_CHECKS__
__TRANSFER_CHECKS__
__ACTION_VISIBILITY_CHECKS__
__KNOWN_SPELL_CHECKS__
__GROUP_CHECKS__
for _,message in ipairs(logs) do assert(not message:find('customization update failed',1,true) and not message:find('builder:',1,true) and not message:find('observer failed',1,true),message) end
originalPrint('Inspector forms, native scrolling, drag/drop hierarchy, bindings, persistence and reload checks passed')
