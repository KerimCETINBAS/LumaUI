local master,editor=__wuiraModules_LumaUI,__wuiraModules_LumaUI_Editor
SettingsPanel=CreateFrame('Frame',nil,UIParent)
Settings={RegisterCanvasLayoutCategory=function()return {GetID=function()return 9 end}end,RegisterAddOnCategory=function()end}
Minimap=CreateFrame('Frame',nil,UIParent);Minimap:SetSize(140,140)
C_AddOns={IsAddOnLoaded=function()return true,true end}
SlashCmdList={};LumaUISettings={}
local payloads={}
C_EncodingUtil={SerializeCBOR=function(value)payloads[#payloads+1]=value;return tostring(#payloads)end,DeserializeCBOR=function(value)return payloads[tonumber(value)]end,
 CompressString=function(v)return v end,DecompressString=function(v)return v end,EncodeBase64=function(v)return v end,DecodeBase64=function(v)return v end}
master.require('index')
local ui=master.require('lua_modules.wuira.lib.index').wuira
local preview
local original=LumaUI.Presets.Preview
LumaUI.Presets.Preview=function(self,document)local result=original(self,document);preview=result;return result end
local function tick()local count=#nativeFrames;for i=1,count do local f=nativeFrames[i];if f:IsVisible() and f.onUpdate then f.onUpdate(f,.3) end end end
local function visible(text)
 for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.fontString and f.fontString.text==text and f:IsVisible() then return f end end
end
local function click(text)
 local p=assert(visible(text),'missing control '..text)
 while p and p~=UIParent do if p.kind=='Button' and p.scripts.OnClick then p.scripts.OnClick(p);return end;p=p.parent end
 error('not clickable '..text)
end
local function input(text)
 for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.kind=='EditBox' and f:IsVisible() and f.text==text then return f end end
 error('missing input '..text)
end
local document={version=1,kind='preset',id='safety',name='Safety component',sources={{name='hp',type='hp',props={unit='player'}}},
 root={id='root',type='flow',props={width=220,height=100},children={
 {id='branch',type='flow',props={width=80,height=30},children={{id='button',type='secureButton',props={width=24,height=24,action={type='spell',spell=635}}}}},
 {id='bar',type='progress',source='hp',props={width=220,height=20}}
 }}}
-- Core-only JSX preview works before Editor is initialized, with no protected targets.
local large={version=1,kind='preset',id='large',name='Large',sources={},root={id='large-root',type='secureButton',props={width=4000,height=2000,mode='absolute',anchor='BOTTOM',x=120,y=330,action={type='spell',spell=635}}}}
local changed
local root=ui.Mount(nil,LumaUI:Preview({document=large,width=300,height=180,zoom='fit',onZoomChange=function(_,value)changed=value end}))
local target=assert(preview.Nodes:get('large-root'))
assert(target.kind=='Frame' and not target.attributes and target.scale<.125 and target.scale>0,'Fit accommodates large components without secure action buttons')
assert(target.width==4000 and target.height==2000 and target.x==0 and target.y==0,'preview preserves dimensions and rebases screen coordinates')
local count=#nativeFrames;click('1:1');assert(target.scale==1 and changed==1);click('-');assert(target.scale==.8);click('+');assert(target.scale==1)
assert(#nativeFrames==count and large.root.props.x==120 and large.root.props.width==4000,'zoom updates existing frames without modifying the document')
click('Fit');assert(changed=='fit' and target.scale<.125)
ui.Unmount(nil,root);assert(preview.Nodes.size==0,'shared preview cleanup releases sources and nodes')
-- Validation updates the existing textbox, disposes stale previews and skips headless effects.
local wire=LumaUI.Presets:Export(document)
LumaUI:OpenImport('preset')
local box=input('')
local dialog=box;while dialog.parent and dialog.parent~=UIParent do dialog=dialog.parent end
assert(dialog.strata=='FULLSCREEN_DIALOG' and dialog.frameLevel>=100,'transfer dialog is above the configuration window')
assert(box.parent.textures[1].color[4]==1 and box.parent.parent.textures[1].color[4]==1,'input and dialog surfaces are opaque')
box:SetText('invalid');tick()
assert(input('invalid')==box and box.focused,'automatic validation retains the native textbox and focus')
local invalid=false
for _,texture in ipairs(box.parent.textures) do if texture.layer=='OVERLAY' and texture.color[1]==1 and texture.color[2]==.25 then invalid=true end end
assert(invalid,'invalid text has a red border')
local errorLabel
for _,frame in ipairs(nativeFrames) do if frame:IsVisible() and frame.fontString and frame.fontString.color and frame.fontString.color[1]==1 and frame.fontString.color[2]==.25 then errorLabel=frame.fontString end end
assert(errorLabel and #errorLabel.text>0,'validation error is displayed below the text field')
local headless={version=1,kind='preset',id='headless-test',name='Headless',sources={},root={id='none',type='fragment',props={},children={{id='hide',type='hideUnitFrame',props={unit='player'}}}}}
box:SetText(LumaUI.Presets:Export(headless));tick()
assert(dialog.height==440 and visible('Valid component · no visual output.') and not visible('PREVIEW'),'headless imports have no preview area')
box:SetText(wire);tick()
assert(input(wire)==box and visible('PREVIEW') and errorLabel.text=='Valid string · ready to import.','valid input clears the error and automatically previews')
assert(box.parent.parent.height==dialog.height and dialog.height>400,'the opaque surface expands to cover the entire preview and footer')
local prior=preview
box:SetText('broken')
assert(prior.Nodes.size==0 and not visible('PREVIEW'),'editing disposes the stale preview immediately')
click('Close')
assert(not box.scripts.OnTextChanged and not box.onUpdate,'closing removes validation listeners')
-- Click Cast metadata is optional in both directions, including nested references.
local service=new(master.require('builder.PresetTransfer').PresetTransfer,LumaUI)
local clickPreset={version=2,kind='clickCast',id='shared-cast',name='Shared cast',bindings={{key='BUTTON1',spellId=635},{key='SHIFT-BUTTON1',spellId=19750}}}
local child={version=1,kind='preset',id='click-child',name='Child',sources={},root={id='unit',type='secureButton',props={width=24,height=24,unit='player',clickCastPreset=clickPreset.id}}}
local shared={version=1,kind='preset',id='click-parent',name='Parent',sources={},dependencies={child},root={id='child',type='preset',preset=child.id,props={}}}
local sharedWire=service:Export(shared,false,{clickPreset})
local savedCount=#LumaUI.ClickCastPresets:List()
LumaUI:OpenImport('preset',nil,sharedWire)
assert(visible('PREVIEW') and preview.Nodes.size>0 and #LumaUI.ClickCastPresets:List()==savedCount,'preview resolves visuals without installing shared Click Cast dependencies')
click('Import Click Cast: Yes');click('Import')
assert(#LumaUI.ClickCastPresets:List()==savedCount and LumaUI.Presets:Get(child.id).root.props.clickCastPreset=='standard','opt-out imports no Click Cast records and clears nested custom references')
local captured
LumaUI:OpenImport('preset',function(_,value)captured=value end,sharedWire);click('Import')
assert(#LumaUI.ClickCastPresets:List()==savedCount+1 and captured.dependencies[1].root.props.clickCastPreset~='standard','opt-in imports and links shared mappings')
assert(LumaUI.ClickCastPresets:Get(captured.dependencies[1].root.props.clickCastPreset).bindings[2].spellId==19750,'multiple combinations survive transfer')
LumaUI:OpenExport(shared,{clickPreset})
local firstOutput
for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.kind=='EditBox' and f:IsVisible() then firstOutput=f;break end end
assert(service:Decode(firstOutput.text,'preset').clickCastPresets~=nil)
click('Export Click Cast: Yes')
local output
for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.kind=='EditBox' and f:IsVisible() then output=f;break end end
local omitted=service:Decode(output.text,'preset')
assert(not omitted.clickCastPresets and omitted.document.dependencies[1].root.props.clickCastPreset=='standard','export opt-out removes metadata and nested links')
assert(shared.dependencies[1].root.props.clickCastPreset==clickPreset.id,'export does not modify the source document')
click('Export Click Cast: No')
for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.kind=='EditBox' and f:IsVisible() then output=f;break end end
assert(output.focused and output.highlighted and #service:Decode(output.text,'preset').clickCastPresets==1,'export opt-in regenerates and selects the string')
click('Close')

-- Import preview uses the same component and writes nothing until Import.
LumaUI:OpenImport('preset',nil,LumaUI.Presets:Export(document))
assert(not visible('Preview'),'import validates and previews without a Preview button')
assert(preview.Nodes:get('button').kind=='Frame' and not LumaUI.Presets:Get(document.id),'import preview is read-only and needs no editor addon')
click('Import');assert(LumaUI.Presets:Get(document.id) and LumaUI.Presets:ActivationStatus(document.id)=='Disabled','Import saves only after confirmation')
local draft
local Draft=editor.require('Draft').EditorDraft
local construct=Draft.prototype.____constructor
Draft.prototype.____constructor=function(self,...)construct(self,...);draft=self end
editor.require('index');LumaUI:EditPreset(LumaUI.Presets:Get(document.id))
assert(not visible('Design') and visible('Undo') and visible('Redo') and visible('Preview') and visible('Component') and visible('Sources'),'global panel row is replaced by local controls')
local function expandPanel(label)
 local heading=assert(visible(label));local row=heading.parent
 for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.fontString and f.fontString.text=='Expand' and f:IsVisible() then
  local p=f;while p and p~=UIParent do if p.parent==row and p.scripts.OnClick then p.scripts.OnClick(p);return end;p=p.parent end
 end end
 error('missing expand for '..label)
end
expandPanel('Properties');tick();assert(draft.workspaceView=='inspector' and visible('Width') and not visible('Component'),'properties expand independently')
click('Restore');tick();assert(draft.workspaceView=='design')
expandPanel('Hierarchy');tick();assert(draft.workspaceView=='hierarchy' and not visible('Width'))
click('Restore');tick()
-- Real edits and subtree removal form independent, detached history entries.
draft:Select('root');tick();draft:Resize('width',10);tick();assert(draft.Selected.width==230 and draft.CanUndo)
click('Undo');tick();assert(draft.Selected.width==220 and not draft.dirty and draft.CanRedo,'undo returns to the saved baseline')
click('Redo');tick();assert(draft.Selected.width==230 and draft.dirty)
click('Save');tick();assert(not draft.dirty and LumaUI.Presets:Get(document.id).root.props.width==230)
click('Undo');tick();assert(draft.Selected.width==220 and draft.dirty,'undo after Save changes only the draft')
click('Redo');tick();assert(draft.Selected.width==230 and not draft.dirty,'redo to the saved baseline clears dirty')
draft:Select('branch');tick();local before=#draft.nodes;draft:Remove();tick();assert(#draft.nodes==before-2)
click('Undo');tick();assert(#draft.nodes==before and draft.nodes[2].id=='branch' and draft.nodes[3].id=='button','undo restores the whole subtree and ordering')
click('Redo');tick();assert(#draft.nodes==before-2);click('Undo');tick()
draft:Select('root');tick();draft:Resize('height',3);tick();assert(not draft.CanRedo,'new edits clear the redo branch')
draft.propertyEditor:Open();draft.propertyEditor.values.width='250';draft.propertyEditor.inputs:clear()
click('Undo');tick();assert(draft.Selected.width==230,'Undo includes pending valid form values')
click('Redo');tick();assert(draft.Selected.width==250)
draft:UpdateSources({{name='hp',type='hp',props={unit='player'}},{name='class',type='class',props={unit='player'}}});tick()
click('Undo');tick();assert(#draft.sources==1);click('Redo');tick();assert(#draft.sources==2,'source configuration participates in history')
draft:UpdateActivation({enabled='never'});tick();click('Undo');tick();assert(draft.activationMode~='never');click('Redo');tick();assert(draft.activationMode=='never')
-- Redo must not discard an unfinished rename.
draft:Undo();tick();assert(draft.CanRedo)
draft:StartRename();tick();input(draft.documentName):SetText('Pending rename')
assert(not draft.CanRedo and draft.CanUndo)
draft:Redo();tick();assert(draft.renaming and input('Pending rename'),'Redo cannot silently discard rename input')
draft:CancelRename();tick();draft:Redo();tick()
-- Unfinished native inputs, scroll, panel focus and zoom survive combat without an Apply.
draft:SetWorkspace('design');draft:SetInspector('sources');tick()
local sourceInput=input('player');sourceInput:SetText('target');input('player'):SetText('focus')
draft.propertyEditor:Ensure();input('250'):SetText('263')
draft.treeScroll=0;draft.sourceEditor.scroll=0;draft.previewZoom=.5
draft:StartRename();tick();input(draft.documentName):SetText('Unfinished name')
draft:SetWorkspace('preview');tick()
local window
for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.strata=='DIALOG' and f.movable and f.width==1160 and f:IsVisible() then window=f;break end end
assert(window);window:SetPoint('CENTER',UIParent,'CENTER',25,45)
local history=draft.CanUndo
combat=true;emit('PLAYER_REGEN_DISABLED')
assert(not window:IsShown() and draft.sourceEditor.values.unit=='focus' and draft.sourceEditor:For('class').values.unit=='target' and draft.propertyEditor.values.width=='263' and draft.renameValue=='Unfinished name','combat flushes native inputs into the retained draft: '..tostring(window:IsShown())..' / '..tostring(draft.sourceEditor.values.unit)..' / '..tostring(draft.propertyEditor.values.width)..' / '..tostring(draft.renameValue))
assert(LumaUI.Presets:Get(document.id).name=='Safety component' and LumaUI.Presets:Get(document.id).root.props.width==230,'combat never saves or applies unfinished edits')
combat=false;emit('PLAYER_REGEN_ENABLED');tick()
assert(window:IsShown() and window.x==25 and window.y==45 and draft.workspaceView=='preview' and draft.inspector=='sources','combat end restores the same window and panel state')
assert(draft.treeScroll==0 and draft.sourceEditor.scroll==0 and draft.previewZoom==.5 and draft.CanUndo==history and input('target') and input('focus') and input('Unfinished name'),'forms, history and zoom are retained')
-- A second transition cannot create duplicate open windows or consume history.
combat=true;emit('PLAYER_REGEN_DISABLED');combat=false;emit('PLAYER_REGEN_ENABLED');tick()
assert(window:IsShown() and input('target') and draft.HasUnsavedChanges)
LumaUI:CloseCustomization();combat=true;emit('PLAYER_REGEN_DISABLED');combat=false;emit('PLAYER_REGEN_ENABLED');assert(not window:IsShown(),'a manually closed editor stays closed')
-- Inspector reference settings and exposed source forms round-trip independently.
local reusable={version=1,kind='preset',id='reusable',name='Reusable',sources={{name='health',type='hp',props={}}},root={id='bar',type='progress',source='health',props={width=100,height=10}}}
LumaUI.Presets:Save(reusable)
local reuseDraft=new(editor.require('Draft').EditorDraft)
reuseDraft:Load(reusable);reuseDraft.sourceEditor:Open('health',false)
reuseDraft.sourceEditor:Expose(true);reuseDraft.sourceEditor:SetOptional(true);assert(reuseDraft.sourceEditor:Save())
local sourceInput=reuseDraft:Document().sources[1]
assert(sourceInput.isProp and sourceInput.optional and next(sourceInput.props)==nil,'exposed source is an empty typed input')
LumaUI.Presets:Save(reuseDraft:Document())
local parent={version=1,kind='preset',id='reference-owner',name='Reference owner',sources={{name='parentHP',type='hp',props={unit='target'}}},root={id='child',type='preset',preset='reusable',props={}}}
reuseDraft:Load(parent);reuseDraft:SetReferenceActivation('enabled','never');reuseDraft:SetReferenceSource('health','parentHP')
local node=reuseDraft:Document().root
assert(node.activation.enabled=='never' and node.sourceProps.health=='parentHP')
reuseDraft:Undo();assert(not reuseDraft:Document().root.sourceProps or reuseDraft:Document().root.sourceProps.health==nil,'source bindings support undo')
reuseDraft:Redo();assert(reuseDraft:Document().root.sourceProps.health=='parentHP')
assert(LumaUI.Presets:Get('reusable').enabled=='condMet','instance activation never edits definition')
local renamed={version=1,kind='preset',id='rename-old',name='Rename old',sources={},root={id='box',type='cell',props={width=10,height=10}}}
LumaUI.Presets:Save(renamed)
local user={version=1,kind='preset',id='rename-user',name='Rename user',sources={},root={id='ref',type='preset',preset='rename-old',props={}}}
LumaUI.Presets:Save(user)
reuseDraft:Load(renamed);assert(reuseDraft:Rename('Renamed purpose'));reuseDraft:Commit()
assert(reuseDraft.identityPrompt and LumaUI.Presets:Get('rename-old'),'save asks before changing identity')
reuseDraft:ConfirmIdentity(false)
assert(LumaUI.Presets:Get('renamed-purpose') and not LumaUI.Presets:Get('rename-old'))
reuseDraft:Open('rename-user');assert(reuseDraft:Document().root.preset=='rename-old','missing references remain editable')
reuseDraft:ReplacePreset('renamed-purpose');assert(reuseDraft:Document().root.preset=='renamed-purpose')
-- Library thumbnails must not construct even a source that would fail on secret reads.
local constructors=0
local stopThumbnailSource=LumaUI.Presets:RegisterSource('thumbnailForbidden',{properties={},Create=function()constructors=constructors+1;error('live source touched by thumbnail')end})
local thumbnailDoc={version=1,kind='preset',id='static-thumbnail',name='Static thumbnail',sources={{name='live',type='thumbnailForbidden',props={}}},root={id='bar',type='progress',source='live',props={width=200,height=20}}}
local thumbnailModule=master.require('builder.ComponentPreview')
local static=thumbnailModule.thumbnailDocument(nil,thumbnailDoc,LumaUI.Presets)
assert(#static.sources==0 and static.root.source==nil and static.root.props.current==75)
local thumbnail=ui:Mount(thumbnailModule.ComponentThumbnail(nil,thumbnailDoc,180,76,LumaUI.Presets,LumaUI.Theme))
assert(constructors==0 and thumbnailDoc.root.source=='live','thumbnail never constructs live sources or changes stored data')
ui:Unmount(thumbnail);assert(constructors==0)
stopThumbnailSource()
-- Target identity invalidation refreshes dependent values without rewriting secure attributes.
do
 local savedName,savedHealth,savedMax=UnitName,UnitHealth,UnitHealthMax
 local name,health='Target A',100
 UnitName=function(unit)if unit=='target'then return name end;return savedName and savedName(unit)end
 UnitHealth=function(unit)if unit=='target'then return health end;return savedHealth(unit)end
 UnitHealthMax=function(unit)if unit=='target'then return 1000 end;return savedMax(unit)end
 local widgets=master.require('builder.UnitWidgets')
 local text=ui:Mount(widgets.unitText(nil,{width=100,height=20},'target','name',false))
 assert(text.fontString.text=='Target A')
 local targetSource=new(master.require('lua_modules.wuira.lib.datasources.UnitSource').UnitSource,'target')
 local hp=new(master.require('lua_modules.wuira.lib.datasources.Resources').HP,targetSource)
 local observed
 local stopHP=hp:onChange(function(_,value)observed=value end)
 local secure=CreateFrame('Button',nil,UIParent,'SecureActionButtonTemplate')
 local stopButton=master.require('builder.UnitButton').configureUnitButton(nil,secure,targetSource,nil,false)
 local set=secure.SetAttribute
 secure.SetAttribute=function(self,...)assert(not combat,'target identity must not rewrite protected attributes in combat');return set(self,...)end
 name='Target B';health=200;combat=true;emit('PLAYER_TARGET_CHANGED');combat=false
 assert(text.fontString.text=='Target B' and observed==200,'target changes refresh text and HP')
 stopButton();stopHP();ui:Unmount(text)
 name='Target C';health=300;emit('PLAYER_TARGET_CHANGED');assert(observed==200,'unmounted target subscriptions stop')
 UnitName,UnitHealth,UnitHealthMax=savedName,savedHealth,savedMax
end
-- Headless groups are an optional root, and removing one preserves the child.
local rootDraft=new(editor.require('Draft').EditorDraft);rootDraft:New()
assert(rootDraft:Document().root.type=='cell','new cells do not require a headless wrapper')
rootDraft:SetRootKind('fragment');rootDraft:Add('cell')
local childID=rootDraft.selected;rootDraft:Add('label');local labelID=rootDraft.selected
rootDraft:Select('root');rootDraft:Remove()
assert(rootDraft.nodes[1].id==childID and rootDraft:Document().root.children[1].id==labelID,'removing the wrapper promotes its intact content')
rootDraft:Undo();assert(rootDraft.nodes[1].kind=='fragment','wrapper removal supports Undo')
rootDraft:Redo();assert(rootDraft.nodes[1].id==childID)
rootDraft.nodes[1].props.direction='horizontal';rootDraft:SetRootKind('flow');assert(rootDraft.nodes[1].props.direction=='horizontal','root conversion preserves compatible layout properties')
-- Element labels survive exports and history without changing technical IDs.
local beforeID=labelID
assert(rootDraft:RenameNode(labelID,'Damage label'))
assert(rootDraft:Document().root.children[1].name=='Damage label' and rootDraft:Document().root.children[1].id==beforeID)
rootDraft:Undo();assert(rootDraft:Document().root.children[1].name==nil)
rootDraft:Redo();assert(rootDraft:Document().root.children[1].name=='Damage label')
local roundtrip=LumaUI.Presets:Import(LumaUI.Presets:Export(rootDraft:Document()))
local loaded=new(editor.require('Draft').EditorDraft);loaded:Load(roundtrip)
assert(loaded:Document().root.children[1].name=='Damage label')
assert(not loaded:RenameNode(labelID,'  '),'empty element names are rejected')
assert(loaded.documentName==roundtrip.name,'element rename does not rename the component')
print('Editor safety: shared preview, zoom, import, panels, undo/redo and combat retention passed')
