local master,editor=__wuiraModules_LumaUI,__wuiraModules_LumaUI_Editor
SettingsPanel=CreateFrame('Frame',nil,UIParent)
Settings={RegisterCanvasLayoutCategory=function()return {GetID=function()return 9 end}end,RegisterAddOnCategory=function()end}
Minimap=CreateFrame('Frame',nil,UIParent);Minimap:SetSize(140,140)
C_AddOns={IsAddOnLoaded=function()return true,true end};SlashCmdList={};LumaUISettings={}
local payloads={}
C_EncodingUtil={SerializeCBOR=function(value)payloads[#payloads+1]=value;return tostring(#payloads)end,DeserializeCBOR=function(value)return payloads[tonumber(value)]end,CompressString=function(v)return v end,DecompressString=function(v)return v end,EncodeBase64=function(v)return v end,DecodeBase64=function(v)return v end}
master.require('index')
local api=LumaUI.Presets
local UI=master.require('lua_modules.wuira.lib.ui.index').UI
local mount=master.require('lua_modules.wuira.lib.index').wuira
local UnitSource=master.require('lua_modules.wuira.lib.datasources.UnitSource').UnitSource
local function doc(id,sources,root,deps) return {version=1,kind='preset',id=id,name=id,sources=sources or {},root=root or {id='root',type='cell',props={width=40,height=20}},dependencies=deps} end
local function input(name,kind,optional)return {name=name,type=kind,props={},isProp=true,optional=optional or false}end
local function ref(id,child,props)return {id=id,type='preset',preset=child,props={},sourceProps=props or {}}end
local function copy(value)return master.require('builder.validate').copy(nil,value)end
assert(api:SourcesCompatible('mana','hp') and api:SourcesCompatible('mathConverter','hp'),'structural progress/value capabilities support different source types')
assert(api:SourcesCompatible('groupMembers','list') and not api:SourcesCompatible('list','groupMembers'),'unit-list semantics are part of the capability contract')
assert(not api:SourcesCompatible('unit','hp') and not api:SourcesCompatible('hp','list'),'incompatible contracts reject')
local made,disposed,derived,derivedDisposed,subscriptions,unsubscribed=0,0,0,0,0,0
local shared,seen={},{ }
api:RegisterSource('owned-unit',{capabilities={'unit'},properties={},Create=function()
 made=made+1;local u=new(UnitSource,'player');local value={unit=u,Dispose=function() disposed=disposed+1 end};shared[#shared+1]=value;return value
end})
api:RegisterSource('derived-unit',{properties={source={type='string',required=true}},references={'source'},Create=function(_,props,context)
 derived=derived+1;local borrowed=context:Source(props.source);return {unit=borrowed.unit,progress=new(master.require('lua_modules.wuira.lib.datasources.Resources').HP,borrowed.unit),Dispose=function()derivedDisposed=derivedDisposed+1 end}
end})
api:RegisterComponent('contract-probe',{children='none',source='progress',properties={},Create=function(_,props,children,context)
 local borrowed=context:ResolveSource('NamedUnitSource');local own=context:ResolveSource('local');seen[#seen+1]={borrowed=borrowed,own=own,context=context}
 return UI.createElement(nil,'cell',{width=40,height=20,onMount=function()
  subscriptions=subscriptions+1;local stop=borrowed.unit:onChange(function()end)
  return function()stop();unsubscribed=unsubscribed+1 end
 end})
end})
local child=doc('contract-child',{input('NamedUnitSource','unit'),{name='local',type='derived-unit',props={source='NamedUnitSource'}}},{id='probe',type='contract-probe',props={},source='local'})
local parent=doc('contract-parent',{{name='owner',type='owned-unit',props={}}},{id='root',type='flow',props={width=100,height=60},children={ref('a',child.id,{NamedUnitSource='owner'}),ref('b',child.id,{NamedUnitSource='owner'})}},{child})
local instance=api:Mount(parent)
assert(made==1 and derived==2 and #seen==2 and seen[1].borrowed==shared[1] and seen[2].borrowed==shared[1],'one owner instance shared by distinct children')
assert(seen[1].own~=seen[2].own and subscriptions==2,'child-local sources and consumer subscriptions are isolated')
instance:Dispose();assert(disposed==1 and derivedDisposed==2 and unsubscribed==2,'owner and child resources clean up exactly once')
local middle=doc('contract-middle',{input('forward','unit')},ref('leaf',child.id,{NamedUnitSource='forward'}),{child})
local outer=doc('contract-outer',parent.sources,ref('middle',middle.id,{forward='owner'}),{middle})
instance=api:Mount(outer);assert(made==2 and seen[3].borrowed==shared[2],'nested components forward the actual instance');instance:Dispose()
local missing=copy(parent);missing.root.children[1].sourceProps={};missing.root.children[2].sourceProps={}
instance=api:Mount(missing);assert(made==2 and derived==3,'missing required input does not construct inputs or dependents');instance:Dispose()
missing.dependencies[1].sources[1].optional=true
instance=api:Mount(missing);assert(made==2 and derived==3,'optional unbound dependencies remain dormant');instance:Dispose()
local bad=copy(parent);bad.sources[1].type='hp';assert(not pcall(function()api:Validate(bad)end),'mismatch fails before runtime')
bad=copy(parent);bad.root.children[1].sourceProps.NamedUnitSource='missing';assert(not pcall(function()api:Validate(bad)end),'missing source is explicit')
bad=copy(parent);bad.root.children[1].sourceProps.NamedUnitSource='parent.$unit';assert(not pcall(function()api:Validate(bad)end),'parent.$unit outside Repeat rejects')
local factory=api.sources:get('owned-unit');local before=made
api:Validate(child);local preview=api:Preview(child);preview:Dispose();assert(made==before,'an input definition never creates a preview instance')
local exported=doc('exported-health',{input('Member','unit'),{name='HP',type='hp',props={unit='Member'}}},{id='bar',type='progress',props={width=80,height=12},source='HP'})
local shown=api:Preview(exported);shown.Frame=mount:Mount(shown.View);assert(shown.Nodes:get('bar').value==75,'editor preview simulates an exported unit input');shown:Dispose()
local readyPreview=api:Preview(doc('ready-health-preview',{input('Health','hp')},{id='bar',type='progress',props={width=80,height=10},source='Health'}))
readyPreview.Frame=mount:Mount(readyPreview.View);assert(readyPreview.Nodes:get('bar').value==75,'editor preview simulates an exported health input');readyPreview:Dispose()
local authored=api:Preview(doc('authored-health',{{name='Health',type='hp',props={initial=40,maximum=80},isProp=true}},{id='bar',type='progress',props={width=80,height=10},source='Health'}))
authored.Frame=mount:Mount(authored.View);assert(authored.Nodes:get('bar').value==40 and authored.Nodes:get('bar').max==80,'preview draws the authored initial value');authored:Dispose()
local resting=api:Preview(doc('resting-health',{{name='Health',type='hp',props={initial=40,maximum=80}}},{id='bar',type='progress',props={width=80,height=10},source='Health'}))
resting.Frame=mount:Mount(resting.View);assert(resting.Nodes:get('bar').value==40 and resting.Nodes:get('bar').max==80,'a source preview draws its own initial value');resting:Dispose()
local unusedInput=doc('unused-input',{input('Unused','unit')})
local unusedOwner=doc('unused-owner',{{name='owner',type='owned-unit',props={}}},ref('unused',unusedInput.id,{Unused='owner'}),{unusedInput})
before=made;instance=api:Mount(unusedOwner);assert(made==before,'declaring and binding an unused input does not instantiate its upstream source');instance:Dispose()
-- Generic ready HP, list and converter inputs use the same named contract.
local healthChild=doc('ready-health',{input('Health','hp')},{id='bar',type='progress',props={width=80,height=10},source='Health'})
local healthParent=doc('ready-parent',{{name='mana',type='mana',props={}},{name='converted',type='mathConverter',props={source='mana',expression='input.current'}}},ref('child',healthChild.id,{Health='mana'}),{healthChild})
healthParent.sources[2].props.expression='input';healthParent.sources[2].props.path=nil
instance=api:Mount(healthParent);assert(instance.Nodes:get('child/bar').max==maxMana);instance:Dispose()
healthParent.root.sourceProps.Health='converted';instance=api:Mount(healthParent);assert(instance.Nodes:get('child/bar').value==mana);instance:Dispose()
local listChild=doc('ready-list',{input('Rows','list')},{id='repeat',type='foreach',source='Rows',props={},children={ref('item','empty')}} ,{doc('empty')})
instance=api:Mount(doc('list-parent',{{name='list',type='list',props={items={{key='x'}}}}},ref('child',listChild.id,{Rows='list'}),{listChild}));assert(instance.Nodes:get('child/repeat/x/root'));instance:Dispose()
-- Roster identity reuse changes tokens without sharing one child's local scope with another.
local ids={player='A',party1='B'}
function UnitGUID(token)return ids[token]end
function UnitExists(token)return ids[token]~=nil end
function UnitFullName(token)return ids[token],'Realm'end
function UnitName(token)return ids[token]end
function UnitClass()return 'Mage','MAGE',8 end
function UnitIsConnected()return true end
function UnitGroupRolesAssigned()return 'DAMAGER'end
function UnitIsGroupLeader()return false end
function IsInRaid()return false end
function GetNumGroupMembers()return 2 end
local repeated=doc('repeat-parent',{{name='members',type='groupMembers',props={scope='party'}},{name='shared',type='owned-unit',props={}}},{id='repeat',type='foreach',source='members',props={direction='vertical'},children={ref('member',child.id,{NamedUnitSource='parent.$unit'})}},{child})
local first=#seen;instance=api:Mount(repeated)
assert(#seen==first+2 and seen[first+1].borrowed~=seen[first+2].borrowed,'Repeat gives each member a distinct input instance')
local a,b=seen[first+1],seen[first+2];local original=instance.Nodes:get('repeat/guid:A/probe');local total=derived
ids.player='B';ids.party1='A';emit('GROUP_ROSTER_UPDATE')
assert(derived==total and instance.Nodes:get('repeat/guid:A/probe')==original and a.borrowed.unit.Token=='party1' and b.borrowed.unit.Token=='player','stable GUID reuses its instance while retargeting UnitSource')
ids.party1='C';emit('GROUP_ROSTER_UPDATE');assert(derived==total+1 and not instance.Nodes:get('repeat/guid:A/probe') and derivedDisposed>=1,'removed member is disposed and new identity gets fresh sources')
instance:Dispose();assert(derivedDisposed==derived and subscriptions==unsubscribed,'all repeated subscriptions and derived instances cleaned')
-- Parent-owned sources remain one instance even when many repeated children borrow them.
repeated.root.children[1].sourceProps.NamedUnitSource='shared';before=made;instance=api:Mount(repeated);assert(made==before+1,'Repeat does not clone parent sources per member');instance:Dispose()
-- Nested Repeat uses the nearest iterator, never the outer member.
local inner=doc('inner',{input('Outer','unit'),{name='members',type='groupMembers',props={scope='party'}}},{id='inner-repeat',type='foreach',source='members',props={},children={ref('inner-member',child.id,{NamedUnitSource='parent.$unit'})}},{child})
repeated.dependencies={inner};repeated.root.children[1]=ref('outer-member',inner.id,{Outer='parent.$unit'});first=#seen
instance=api:Mount(repeated);assert(#seen==first+4 and seen[first+1].borrowed~=seen[first+3].borrowed,'nested Repeat creates independent nearest-member scopes');instance:Dispose()
inner.root=ref('invalid',child.id,{NamedUnitSource='parent.$unit'});assert(not pcall(function()api:Validate(repeated)end),'a nested component cannot capture an outer ambient member')
-- Inline legacy extraction preserves content, pet slots, bindings and local source ownership.
local legacy=doc('legacy',{{name='members',type='groupMembers',props={pets=true}},{name='hp',type='hp',props={unit='$unit'}},{name='mana',type='mana',props={unit='$unit'}}},{id='repeat',type='foreach',source='members',props={},children={{id='bar',type='progress',source='hp',props={width=80,height=10}},{id='pet',type='progress',source='mana',props={width=80,height=10}}}})
local normalized=api:Validate(legacy)
assert(legacy.root.children[1].type=='progress' and normalized.root.children[1].type=='preset' and #normalized.dependencies==2 and #normalized.sources==1,'migration is lossless, detached and moves local sources out of parent')
assert(normalized.dependencies[1].sources[1].props.unit=='NamedUnitSource' and normalized.root.children[1].sourceProps.NamedUnitSource=='parent.$unit','legacy unit becomes a visible named input')
local wire=api:Export(normalized);local restored=api:Import(wire);assert(restored.dependencies[2].root.source=='mana','export retains both template definitions')
-- Scoped rename is atomic, opt-in and survives persistence, undo and redo.
local ren=doc('rename',{{name='health',type='hp',props={}},{name='out',type='mathConverter',props={source='health',expression='input',path='current'}}},{id='root',type='flow',props={},children={{id='bar',type='progress',source='health',props={}},{id='text',type='label',props={text=''},textSource='out',bindings={alpha={source='out'}}},ref('nested',healthChild.id,{Health='health'})}},{healthChild})
local yes=api:RenameSource(ren,'health','NewHealth',true)
assert(yes.sources[2].props.source=='NewHealth' and yes.root.children[1].source=='NewHealth' and yes.root.children[3].sourceProps.Health=='NewHealth','rename rewrites local sources, elements and prop values')
assert(yes.dependencies[1].sources[1].name=='Health' and ren.sources[1].name=='health','other scopes and original remain unchanged')
local no=api:RenameSource(ren,'health','NewHealth',false);assert(no.root.children[1].source=='health' and not pcall(function()api:Validate(no)end),'declined rewrite keeps an explicit missing reference')
assert(api:Import(api:Export(no)).root.children[1].source=='health','broken references remain repairable after transfer')
assert(not pcall(function()api:RenameSource(ren,'health','out',true)end) and not pcall(function()api:RenameSource(ren,'health','',true)end) and ren.sources[1].name=='health','invalid renames leave originals intact')
local draft=new(editor.require('draft.Draft').EditorDraft);draft:Load(ren);draft:RenameSource('health','NewHealth',true);assert(draft.sources[1].name=='NewHealth');draft:Undo();assert(draft.sources[1].name=='health');draft:Redo();assert(draft.sources[1].name=='NewHealth','rename participates in history')
api:Save(healthChild);local caller=doc('caller',{{name='ready',type='hp',props={}}},ref('use',healthChild.id,{Health='ready'}));api:Save(caller)
local renamed=api:RenameSource(healthChild,'Health','HitPoints',true);api:ApplySourceRenames(renamed,{{oldName='Health',newName='HitPoints',updateReferences=true}})
assert(api:Get('caller').root.sourceProps.HitPoints=='ready' and not api:Get('caller').root.sourceProps.Health,'input rename updates saved parent keys')
renamed=api:RenameSource(renamed,'HitPoints','HealthAgain',false);api:ApplySourceRenames(renamed,{{oldName='HitPoints',newName='HealthAgain',updateReferences=false}})
assert(api:Get('caller').root.sourceProps.HitPoints=='ready' and not pcall(function()api:Validate(api:Get('caller'))end),'declined input rewrite keeps saved callers explicitly broken')
-- Inspect the actual Data tab controls and select a source without typing a reference string.
local inspector=editor.require('inspector.ComponentReferenceInspector').ComponentReferenceInspector
local sourceDraft=new(editor.require('draft.Draft').EditorDraft);sourceDraft:Load(parent);sourceDraft:Select('a');sourceDraft.propertyEditor:Section('Data')
local view=mount.Mount(nil,inspector(nil,{draft=sourceDraft,width=280,height=600}))
local labels={};for _,frame in ipairs(nativeFrames)do if frame.fontString and frame:IsVisible()then labels[frame.fontString.text]=true end end
assert(labels['NamedUnitSource · UnitSource · required'] and labels['Data'] and labels.owner,'Data exposes input: '..table.concat((function()local a={}for k in pairs(labels)do a[#a+1]=k end return a end)(),' | '))
mount.Unmount(nil,view)
sourceDraft:SetReferenceSource('NamedUnitSource','owner');assert(sourceDraft.Selected.sourceProps.NamedUnitSource=='owner' and sourceDraft:Document().root.children[1].sourceProps.NamedUnitSource=='owner','Data selection updates serialized contract')
sourceDraft:SetReferenceSource('NamedUnitSource','bad');assert(sourceDraft.Selected.sourceProps.NamedUnitSource=='owner','invalid selection rolls back')
-- Exercise the real popup callback for current-member binding, rather than typing a string.
local dataDraft=new(editor.require('draft.Draft').EditorDraft)
dataDraft:Load(doc('data-roster',{{name='members',type='groupMembers',props={}}},{id='repeat',type='foreach',source='members',props={},children={ref('member',child.id)}},{child}))
dataDraft:Select('member');dataDraft.propertyEditor:Section('Data')
local dataView=mount.Mount(nil,inspector(nil,{draft=dataDraft,width=220,height=600}))
local function clickLabel(text)
 for i=#nativeFrames,1,-1 do local frame=nativeFrames[i]
  if frame.fontString and frame.fontString.text==text and frame:IsVisible()then
   local owner=frame;while owner and owner~=UIParent do if owner.kind=='Button' and owner.scripts.OnClick then owner.scripts.OnClick(owner);return true end;owner=owner.parent end
  end
 end
 return false
end
assert(clickLabel('Not connected'),'Data presents a dropdown for the required input')
assert(clickLabel('Current member'),'Repeat context is selectable from the popup')
assert(dataDraft.Selected.sourceProps.NamedUnitSource=='parent.$unit','popup callback binds the typed named input: '..tostring(dataDraft.message)..' binding='..tostring(dataDraft.Selected.sourceProps.NamedUnitSource))
mount.Unmount(nil,dataView)
local transfer=new(master.require('builder.transfer.PresetTransfer').PresetTransfer,LumaUI)
assert(transfer:Decode(transfer:Export(no),'preset').document.root.children[1].source=='health','editor transfer service preserves repairable missing links')
api:RegisterComponent('literal-filter',{properties={filter={type='string'}},children='none',Create=function()return UI.createElement(nil,'cell',{width=1,height=1})end})
local literalDocument=doc('literal-refs',{{name='player',type='unit',props={unit='target'}}},{id='root',type='flow',props={},children={{id='native',type='hideUnitFrame',props={unit='player'}},{id='text',type='unitText',props={unit='player'}},{id='config',type='literal-filter',props={filter='player'}}}})
local literalRename=api:RenameSource(literalDocument,'player','SelectedUnit',true)
assert(literalRename.root.children[1].props.unit=='player' and literalRename.root.children[2].props.unit=='SelectedUnit' and literalRename.root.children[3].props.filter=='player','rename distinguishes named inputs from native targets and literal filter values')
local pending=new(editor.require('draft.Draft').EditorDraft)
pending:Load(doc('pending-forms',{{name='hp',type='hp',props={}},{name='out',type='mathConverter',props={source='hp',expression='input'}}},{id='bar',type='progress',source='hp',props={width=40,height=10}}))
local pendingForm=pending.sourceEditor:For('out');pendingForm:Set('expression','2 * input')
pending:RenameSource('hp','Health',true);assert(pending.sourceEditor:SaveAll())
assert(pending.sources[2].props.source=='Health' and pending.sources[2].props.expression=='2 * input','pending source forms retain edits without restoring old references')
pending:Load(doc('pending-unit',{{name='Member',type='unit',props={unit='player'}}},{id='name',type='unitText',props={unit='Member',fontSize=12}}))
pending.propertyEditor:Ensure();pending.propertyEditor:Set('fontSize','18');pending:RenameSource('Member','Selected',true);assert(pending.propertyEditor:Save())
assert(pending.Selected.props.unit=='Selected' and pending.Selected.props.fontSize==18,'pending element edits retain renamed unit references')
-- Save/Undo/Save reverses caller key rewrites as well as the child contract.
local undoChild=doc('undo-child',{input('HP','hp')},{id='bar',type='progress',source='HP',props={width=30,height=10}})
api:Save(undoChild);api:Save(doc('undo-parent',{{name='hp',type='hp',props={}}},ref('child',undoChild.id,{HP='hp'})))
local undoDraft=new(editor.require('draft.Draft').EditorDraft);undoDraft:Load(undoChild);undoDraft:RenameSource('HP','Health',true);undoDraft:Apply()
assert(api:Get('undo-parent').root.sourceProps.Health=='hp','saving applies caller rename')
undoDraft:Undo();undoDraft:Apply();assert(api:Get('undo-parent').root.sourceProps.HP=='hp' and api:Get('undo-child').sources[1].name=='HP','Undo then Save reverses caller updates')
undoDraft:Redo();undoDraft:Apply();assert(api:Get('undo-parent').root.sourceProps.Health=='hp','Redo then Save reapplies caller update')
-- Nested legacy iteration extracts nearest scopes before changing literal unit placeholders.
local nestedLegacy=copy(legacy);nestedLegacy.id='nested-legacy';nestedLegacy.root.children={{id='outer',type='flow',props={},children={{id='inner',type='foreach',source='members',props={},children={{id='nested-bar',type='progress',source='hp',props={width=20,height=10}}}}}}}
local nestedNormalized=api:Validate(nestedLegacy);assert(#nestedNormalized.dependencies==2,'nested legacy templates both migrate')
local innermost;for _,definition in ipairs(nestedNormalized.dependencies)do if definition.root.id=='nested-bar' then innermost=definition end end
assert(innermost and innermost.sources[1].props.unit=='NamedUnitSource','inner health derives from its own named member')
local occupied=doc('collision-repeat-template-1');api:Save(occupied)
local collision=copy(legacy);collision.id='collision';local extracted=api:Validate(collision)
assert(extracted.root.children[1].preset~='collision-repeat-template-1' and api:Get(occupied.id).name==occupied.name,'migration never overwrites an unrelated existing identity')
api:Save(normalized);local repeatedImport=api:Validate(legacy)
assert(repeatedImport.root.children[1].preset==normalized.root.children[1].preset,'identical imported template definitions reuse their identity')
-- Missing links can be fixed one at a time after declining a rename.
local repair=new(editor.require('draft.Draft').EditorDraft);repair:Load(ren);repair:RenameSource('health','Renamed',false);repair:Select('bar');repair:BindSource('Renamed','source')
assert(repair.Selected.source=='Renamed' and repair.sources[2].props.source=='health','repairing one link does not require fixing every other link at once')
local malformed=copy(no);malformed.root.children[2].bindings.alpha.source=123
assert(not pcall(function()api:Export(malformed)end),'repairable missing links do not relax source reference schema types')
malformed=copy(no);malformed.root.children[3].sourceProps={obsolete=123}
assert(not pcall(function()api:Export(malformed)end),'obsolete input keys still require valid typed reference values')
-- Current item is an explicit typed input for any list, including a named Repeat reference.
local itemCreated,itemDisposed,itemSubscribed,itemStopped,listStopped=0,0,0,0,0
local itemRows={{key='one',label='A'},{key='two',label='B'}}
local itemList={Value=itemRows};local pushItems
function itemList:onChange(listener)pushItems=listener;return function()listStopped=listStopped+1;pushItems=nil end end
api:RegisterSource('item-test-list',{capabilities={'items'},properties={},Create=function()
 itemCreated=itemCreated+1;return {items=itemList,Dispose=function()itemDisposed=itemDisposed+1 end}
end})
local itemSeen={};local itemUpdates={}
api:RegisterComponent('item-input-probe',{children='none',properties={},Create=function(_,props,children,context)
 local row=context:ResolveSource('Row');itemSeen[#itemSeen+1]=row
 return UI.createElement(nil,'cell',{width=20,height=10,onMount=function()
  itemSubscribed=itemSubscribed+1;local stop=row.value:onChange(function(_,value)itemUpdates[#itemUpdates+1]=value.label end)
  return function()stop();itemStopped=itemStopped+1 end
 end})
end})
local itemLeaf=doc('item-leaf',{input('Row','repeatItem')},{id='cell',type='item-input-probe',props={}})
local itemMiddle=doc('item-middle',{input('Forward','repeatItem')},ref('leaf',itemLeaf.id,{Row='Forward'}),{itemLeaf})
local itemParent=doc('item-parent',{{name='rows',type='item-test-list',props={}}},{id='rows',name='Named Repeat',type='foreach',source='rows',props={},children={ref('child',itemMiddle.id,{Forward='Named Repeat.$item'})}},{itemMiddle})
instance=api:Mount(itemParent)
assert(itemCreated==1 and #itemSeen==2 and itemSeen[1]~=itemSeen[2] and itemSeen[1].value.Value.label=='A','generic list items cross component layers with one instance per row')
local firstItem=itemSeen[1];local firstFrame=instance.Nodes:get('rows/one/leaf/cell')
itemRows={{key='one',label='C'},{key='two',label='D'}};itemList.Value=itemRows;assert(pushItems);pushItems(itemRows)
assert(itemSeen[1]==firstItem and instance.Nodes:get('rows/one/leaf/cell')==firstFrame and firstItem.value.Value.label=='C','same-key item reuse updates data without replacing the component')
assert(itemUpdates[1]=='C' and itemUpdates[2]=='D','reused row subscribers receive the current values')
itemRows={{key='two',label='E'}};itemList.Value=itemRows;pushItems(itemRows)
assert(itemStopped==1 and instance.Nodes:get('rows/one/leaf/cell')==nil,'removed item cleans up only its own consumers')
instance:Dispose();assert(itemDisposed==1 and itemStopped==itemSubscribed and listStopped==1,'Repeat owns item/list lifetime; child unsubscribes on disposal')
local wrongOwner=copy(itemParent);wrongOwner.root.children[1].sourceProps.Forward='Another Repeat.$item'
assert(not pcall(function()api:Validate(wrongOwner)end),'named Repeat cannot resolve outside its creating scope')
local outsideItem=doc('outside-item',{},ref('child',itemLeaf.id,{Row='parent.$item'}),{itemLeaf})
assert(not pcall(function()api:Validate(outsideItem)end),'item references outside Repeat fail explicitly')
-- An incomplete required-input child renders an inert, normalized cell rather than crashing layout.
local unavailableItem=copy(itemParent);unavailableItem.root.children[1].sourceProps={}
local noInputPreview=api:Preview(unavailableItem);noInputPreview.Frame=mount:Mount(noInputPreview.View);noInputPreview:Dispose()
-- New Repeat creates no named items source and advertises its child input immediately.
local itemDraft=new(editor.require('draft.Draft').EditorDraft);itemDraft:New();itemDraft:Add('foreach')
assert(#itemDraft.sources==0 and not itemDraft.Selected.source and not itemDraft.Selected.items,'Repeat starts without an automatically named list source')
local itemSlot=itemDraft:Children(itemDraft.selected)[1];local defaultItem=itemDraft.dependencies[1]
assert(defaultItem.sources[1].isProp and defaultItem.sources[1].name=='Item' and itemSlot.sourceProps.Item=='parent.$item','default component slot has a visible named input and explicit current-item binding')
local emptyRepeat=api:Preview(itemDraft:Document());emptyRepeat.Frame=mount:Mount(emptyRepeat.View);emptyRepeat:Dispose()
itemDraft:Load(itemParent);itemDraft:Select('child');itemDraft.propertyEditor:Open();itemDraft.propertyEditor:Section('Data')
local manualView=mount:Mount(inspector(nil,{draft=itemDraft,width=300,height=700}))
assert(clickLabel('Named Repeat.$item'),'Data shows the current repeat item binding')
assert(clickLabel('List item'),'List item is selectable for a repeat item input')
assert(itemDraft.Selected.sourceProps.Forward=='parent.$item','dropdown commits the repeat item binding')
mount:Unmount(nil,manualView)
itemDraft.propertyEditor:Open();itemDraft.propertyEditor.values['$input.Forward']='Named Repeat.$item'
assert(itemDraft.propertyEditor:Save() and itemDraft.Selected.sourceProps.Forward=='Named Repeat.$item','named manual reference saves')
itemDraft:Undo();assert(itemDraft.Selected.sourceProps.Forward=='parent.$item','manual input binding supports Undo')
itemDraft:Redo();assert(itemDraft.Selected.sourceProps.Forward=='Named Repeat.$item','manual input binding supports Redo')
itemDraft.propertyEditor:Open();itemDraft.propertyEditor.values['$input.Forward']='Wrong.$item'
assert(not itemDraft.propertyEditor:Save() and itemDraft.Selected.sourceProps.Forward=='Named Repeat.$item','invalid typed references leave the old binding intact')
local itemRoundtrip=api:Import(api:Export(itemParent));assert(itemRoundtrip.root.children[1].sourceProps.Forward=='Named Repeat.$item','named item references survive export/import')
local genericInputForm=itemDraft.sourceEditor;genericInputForm:Open();genericInputForm:Type('repeatItem')
assert(genericInputForm.isProp,'choosing Repeat item automatically creates an exposed input')
genericInputForm:Expose(false);assert(genericInputForm.isProp,'Repeat item cannot accidentally create a local observer')
-- Legacy generated empty list placeholders are removed without touching configured or shared sources.
local oldEmpty=copy(itemParent);oldEmpty.sources={{name='items',type='list',props={items={}}}};oldEmpty.root.source='items'
local cleaned=api:Validate(oldEmpty);assert(#cleaned.sources==0 and cleaned.root.source==nil,'old generated empty items placeholder migrates to an unconfigured Repeat')
oldEmpty.sources[1].props.items={{key='keep'}};cleaned=api:Validate(oldEmpty);assert(#cleaned.sources==1 and #cleaned.sources[1].props.items==1,'nonempty list data is retained')
oldEmpty.sources[1].props.items={};oldEmpty.sources[1].isProp=true;oldEmpty.sources[1].props={};cleaned=api:Validate(oldEmpty);assert(#cleaned.sources==1,'public list inputs are retained')
local renameInputDraft=new(editor.require('draft.Draft').EditorDraft);renameInputDraft:Load(parent);renameInputDraft:Select('a');renameInputDraft.propertyEditor:Open()
renameInputDraft:RenameSource('owner','SharedOwner',true)
assert(renameInputDraft.propertyEditor.values['$input.NamedUnitSource']=='SharedOwner' and renameInputDraft.propertyEditor:Save() and renameInputDraft.Selected.sourceProps.NamedUnitSource=='SharedOwner','source rename also rewrites pending manual reference fields')
local repairInputDraft=new(editor.require('draft.Draft').EditorDraft);repairInputDraft:Load(doc('repair-input',{input('MEMBER','class')}))
repairInputDraft.sourceEditor:Open('MEMBER');repairInputDraft.sourceEditor:Type('unit')
assert(repairInputDraft.sourceEditor:Save() and repairInputDraft.sources[1].type=='unit' and repairInputDraft.sources[1].isProp,'an existing input type can be repaired without changing its public name')
local unitAlias=copy(repeated);unitAlias.root.children[1]=ref('member',child.id,{NamedUnitSource='parent.$item'});unitAlias.dependencies={child}
assert(api:Validate(unitAlias),'roster current-item source also carries UnitSource capability')
assert(not api:RepeatSourceCompatible('groupMembers','$item','class'),'a roster item cannot silently masquerade as a derived Unit class source')

local function frameOf(instance, id)
 local found
 instance.Nodes:forEach(function(_, frame, key) if key==id then found=frame end end)
 return found
end
local function colorDoc(id, sourceType, path)
 return doc(id,{{name='RES',type=sourceType,props={unit='player'}}},{id='bar',type='progress',source='RES',props={width=80,height=8},bindings={color={source='RES',path=path}}})
end
local primary=api:Mount(colorDoc('primary-color','power','.ResourceColor'))
local primaryBar=frameOf(primary,'bar')
assert(primaryBar and primaryBar.fillColor and primaryBar.fillColor[1]==0 and primaryBar.fillColor[2]==.2 and primaryBar.fillColor[3]==1 and primaryBar.fillColor[4]==1 and primaryBar.value==120,'primary ResourceColor is rgba and the amount stays numeric')
primary:Dispose()
local manaBar=api:Mount(colorDoc('mana-color','mana','ResourceColor'))
assert(frameOf(manaBar,'bar').fillColor[1]==0 and frameOf(manaBar,'bar').fillColor[3]==1,'mana ResourceColor uses the mana power color')
manaBar:Dispose()
local previewBar=api:Preview(colorDoc('preview-color','power','.ResourceColor'))
previewBar.Frame=mount:Mount(previewBar.View)
local shown=frameOf(previewBar,'bar')
assert(shown and shown.fillColor and shown.fillColor[1]==.2 and shown.fillColor[2]==.45 and shown.fillColor[3]==.95,'preview ResourceColor is the resting color')
previewBar:Dispose()
local layered=api:Mount(doc('layered',{{name='HP',type='hp',props={unit='player'}},{name='RES',type='mana',props={unit='player'}}},
 {id='bar',type='progress',source='HP',props={width=80,height=8},sections={{source='RES',key='progress',color={r=1,g=1,b=1,a=.5},texture='Interface\\Buttons\\WHITE8X8'}}}))
local host=frameOf(layered,'bar')
local overlays=0
for _,frame in ipairs(nativeFrames) do if frame.parent==host and frame.kind=='StatusBar' then overlays=overlays+1 end end
assert(overlays>=1,'an absorb overlay is a second progress inside the same bar')
layered:Dispose()

print('Source contracts: generic inputs, Data inspector, ownership, Repeat isolation, migration and rename passed')
