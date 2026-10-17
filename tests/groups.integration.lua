do
local apiNames={'UnitExists','UnitIsConnected','UnitClass','UnitName','UnitFullName','UnitGUID','UnitGroupRolesAssigned','UnitIsGroupLeader','UnitPowerType','UnitHealth','UnitHealthMax','UnitHealthPercent','UnitPower','UnitPowerMax','UnitPowerPercent','IsInRaid','GetNumGroupMembers','GetRaidRosterInfo','RegisterStateDriver','UnregisterStateDriver','RAID_CLASS_COLORS','PowerBarColor','C_UnitAuras'}
local old={};for _,key in ipairs(apiNames) do old[key]=_G[key] end
local raid,count,class=false,3,'PALADIN'
local ids={player='P1',party1='P2',party2='P3',pet='PET1',partypet1='PET2'}
local missingGUID={}
local connected={}
function UnitIsConnected(unit) local value=connected[unit];if value==nil then return true end;return value end
local raidGroups={2,1,2}
function UnitExists(unit) return ids[unit]~=nil end
function UnitGUID(unit) return not missingGUID[unit] and ids[unit] or nil end
function UnitFullName(unit) return ids[unit] and ('Name'..ids[unit]) or nil,'Realm' end
function UnitClass(unit) return 'Class',class,2 end
function UnitName(unit) return UnitFullName(unit) end
function UnitGroupRolesAssigned(unit) return unit=='player' and 'HEALER' or 'DAMAGER' end
function UnitIsGroupLeader(unit) return unit=='player' end
function UnitPowerType(unit) return unit=='party1' and 1 or 0,unit=='party1' and 'RAGE' or 'MANA' end
function UnitHealth(unit) return unit=='party1' and 777 or 650 end
function UnitHealthMax(unit) return 1000 end
function UnitHealthPercent(unit) return unit=='party1' and 77.7 or 65 end
function UnitPower(unit,kind) assert(kind==select(1,UnitPowerType(unit)));return 40 end
function UnitPowerMax(unit,kind) assert(kind==select(1,UnitPowerType(unit)));return kind==1 and 100 or 200 end
function UnitPowerPercent(unit,kind) return kind==1 and 40 or 20 end
function IsInRaid() return raid end
function GetNumGroupMembers() return count end
function GetRaidRosterInfo(index) return raidGroups[index] and ('Member'..index) or nil,0,raidGroups[index] end
RAID_CLASS_COLORS={PALADIN={r=1,g=.5,b=.7},MAGE={r=.2,g=.5,b=1}}
PowerBarColor={MANA={r=0,g=.3,b=1},RAGE={r=1,g=0,b=0}}
local filters={}
C_UnitAuras={GetAuraDataByIndex=function(unit,index,filter)
 filters[filter]=true
 if filter=='HELPFUL' then return index==1 and {spellId=19740,icon=111} or nil end
 if filter=='HARMFUL|RAID_PLAYER_DISPELLABLE' then return index==1 and {spellId=800,icon=112,dispelName='Disease'} or nil end
 return ({ {spellId=122,icon=113},{spellId=801,icon=114} })[index]
end}
local drivers={}
function RegisterStateDriver(frame,state,condition) assert(not combat and state=='visibility');drivers[frame]=condition end
function UnregisterStateDriver(frame,state) assert(not combat);drivers[frame]=nil end
local function driverTick()
 for frame,condition in pairs(drivers) do
  assert(not condition:find('group:',1,true),'unit visibility must not override manual collection activation')
  if UnitExists(frame.attributes.unit) then frame:Show() else frame:Hide() end
 end
end
__EDITOR_AUTHORING_CHECKS__
local hpDef=LumaUI.Presets.sources:get('hp')
local originalCreate=hpDef.Create
local creates,disposals,sources=0,0,{}
hpDef.Create=function(self,props,context)
 creates=creates+1
 local source=originalCreate(self,props,context)
 local previous=source.Dispose
 source.Dispose=function(self) disposals=disposals+1;if previous then previous(self) end end
 if props.unit=='$unit' then local guid=UnitGUID(source.progress.target.Token);if guid then sources[guid]=source.progress end end
 return source
end
local party=LumaUI.Presets:Get('paladin-party')
local raidDoc=LumaUI.Presets:Get('paladin-raid')
assert(party.root.type=='foreach' and party.root.source=='members' and raidDoc.root.type=='foreach','presets iterate actual source lists')
assert(party.sources[1].type=='groupMembers','roster is a data source')
local function findNode(node,id)
 if node.id==id then return node end
 for _,child in ipairs(node.children or {}) do local found=findNode(child,id);if found then return found end end
end
local presets=LumaUI.ClickCastPresets:List()
assert(#presets>=3 and presets[1].bindings[1].key=='BUTTON1' and presets[2].bindings[1].key=='BUTTON1','independent presets may share mouse combinations')
LumaUI.Presets:Restore();driverTick()
local active=controls.active:get('paladin-party').instance
local function at(unit,id,optional)
 local guid=ids[unit]
 local frame=guid and active.Nodes:get(party.root.id..'/guid:'..guid..'/'..id)
 if not optional then assert(frame,'missing keyed node '..unit..'/'..id) end
 return frame
end
assert(not controls.active:get('paladin-raid'),'raid sources stay unmounted in a party')
assert(creates==5,'only three members and their two pets allocate HP sources')
assert(active.Frame.width==192 and active.Frame.height==276,'actual five entries occupy one column')
local originalRoot,originalP1,originalP2,originalP3=active.Frame,at('player','member-frame'),at('party1','member-frame'),at('party2','member-frame')
local sourceP3=sources.P3
for _,unit in ipairs({'player','party1','party2'}) do
 local outer,heal,cure=at(unit,'member-frame'),at(unit,'member-health'),at(unit,'member-purify')
 local heading=at(unit,'member-heading')
 assert(not at(unit,'member-frame-select',true),'party selection strip is removed')
 assert(heading.kind=='Button' and heading.height==14 and heading.attributes.type1=='target' and heading.attributes.type2=='togglemenu' and heading.attributes.unit==unit,'the name heading owns standard secure actions')
 assert(#outer.textures==0 and #heading.textures==1 and heading.texture.color[1]==.96,'editable class color fills the name heading')
 assert(at(unit,'member-frame-body').x==0 and at(unit,'member-health-bar').width==188,'bars use the removed strip space')
 assert(outer.attributes.type1=='target' and outer.attributes.type2=='togglemenu' and outer.attributes.unit==unit)
 assert(heal.attributes.type1=='spell' and heal.attributes.unit==unit and heal.attributes.spell1==635)
 assert(cure.attributes.spell1==1152 and cure.attributes.unit==unit)
end
assert(at('party1','member-health-bar').value==777 and at('party1','member-power').max==100,'primary rage is independent from mana')
assert(at('party1','member-current').fontString.text=='777' and not at('party1','member-percent',true) and at('party1','member-power').height==2,'compact health and primary resource omit the percentage row')
assert(filters['HARMFUL|RAID_PLAYER_DISPELLABLE'] and filters.HELPFUL and filters.HARMFUL)
-- Fixed Purify icon and chrome; readable auras change only visual animation.
local api=C_UnitAuras
local cure=at('player','member-purify');local root=at('player','member-freedom')
local indicator=at('player','member-purify-icons');local icon=indicator.textures[1];local pulse=icon.animationGroup
local cureEdges={};for _,texture in ipairs(cure.textures) do if texture.layer=='OVERLAY' then cureEdges[#cureEdges+1]=texture end end
local function hover(enter) for _,hook in ipairs(cure.hooks[enter and 'OnEnter' or 'OnLeave'] or {}) do hook(cure) end end
assert(#cureEdges==4 and cureEdges[1].shown and not cure.texture.shown and icon.path==1152,'static Purify icon replaces the debuff icon')
assert(pulse.playing and pulse.looping=='BOUNCE' and pulse.animation.from==1 and pulse.animation.to==.25,'native alpha animation flashes the icon')
local plays=pulse.plays;emit('UNIT_AURA','player');assert(pulse.plays==plays,'unchanged aura state does not restart the animation')
hover(true);assert(cure.texture.shown);hover(false);assert(not cure.texture.shown)
local frameCount=#nativeFrames
C_UnitAuras={GetAuraDataByIndex=function() return nil end};combat=true;emit('UNIT_AURA','player')
assert(cure.shown and cure.attributes.spell1==1152 and cureEdges[1].shown and icon.shown and not pulse.playing and icon.alpha==1 and #nativeFrames==frameCount,'known empty state keeps a static clickable icon and muted border')
hover(true);assert(cure.texture.shown,'hover communicates the fixed clickable region even with no debuff')
C_UnitAuras={GetAuraDataByIndex=function() return {dispelName={secret=true}} end};emit('UNIT_AURA','player')
assert(not pulse.playing and indicator.fontString.text=='?','unknown restricted auras do not create a false alert')
C_UnitAuras=api;emit('UNIT_AURA','player')
assert(pulse.playing and cureEdges[1].color[1]==1 and cure.texture.shown and root.textures[1].shown and #nativeFrames==frameCount,'aura arrival changes border and animation in combat without allocation')
combat=false;hover(false)

assert(at('pet','pet-frame').shown and not at('party3','member-frame',true),'no speculative party slots')
local headingFill=at('player','member-heading').texture
class='MAGE';emit('UNIT_NAME_UPDATE','player');assert(headingFill.color[1]==.25,'heading fill tracks the displayed unit class')
class='PALADIN';emit('UNIT_NAME_UPDATE','player')
-- Connection swaps only visual alpha; no secure attributes, geometry or source identities change.
assert(not findNode(party.root,'member-role') and not findNode(raidDoc.root,'member-role'),'starter headings omit role icons')
local online,offline=at('party1','member-online-resources'),at('party1','member-offline')
assert(online.alpha==1 and offline.alpha==0 and offline.fontString.text=='OFFLINE')
assert(offline.relative==online,'offline panel anchors to the resource area')
local connectionFrames=#nativeFrames
local healthSource=sources.P2
combat=true;connected.party1=false;emit('UNIT_CONNECTION','party1')
assert(online.alpha==0 and offline.alpha==1 and at('party1','member-heading').alpha~=0,'offline replaces all resource visuals while keeping the heading')
assert(online.shown and at('party1','member-health').shown and at('party1','member-health').attributes.spell1==635,'combat does not hide or modify protected buttons')
assert(sources.P2==healthSource and creates==5 and disposals==0 and #nativeFrames==connectionFrames,'disconnect does not rebuild frames or subscriptions')
connected.party1=true;emit('UNIT_CONNECTION','party2')
assert(online.alpha==0,'unrelated unit events do not change this member')
emit('UNIT_CONNECTION','party1');assert(online.alpha==1 and offline.alpha==0,'reconnect restores the same resource tree')
connected.party1=false;emit('GROUP_ROSTER_UPDATE');assert(offline.alpha==1,'roster refresh also updates connection state')
connected.party1={secret=true};emit('UNIT_CONNECTION','party1');assert(offline.alpha==0 and online.alpha==1,'restricted data cannot falsely mark a member offline')
connected.party1=true;emit('UNIT_CONNECTION','party1');combat=false

local beforeFrames=#nativeFrames
local beforeAnchors=originalP2.pointCalls
emit('UNIT_CONNECTION','party1');emit('UNIT_CONNECTION','party1')
assert(creates==5 and disposals==0 and #nativeFrames==beforeFrames and at('party1','member-frame')==originalP2,'DC/online preserves cells, sources and subscriptions')
assert(originalP2.pointCalls==beforeAnchors,'unchanged metadata does not repeat native anchor mutations')
missingGUID.party1=true;emit('UNIT_CONNECTION','party1');missingGUID.party1=nil
assert(at('party1','member-frame')==originalP2 and creates==5,'cached full-name identity survives temporarily unavailable GUID')
count=4;ids.party3='P4';emit('GROUP_ROSTER_UPDATE');driverTick()
assert(creates==6 and disposals==0 and active.Frame==originalRoot and at('player','member-frame')==originalP1 and at('party2','member-frame')==originalP3,'joining creates only the new member')
assert(active.Frame.width==392 and at('partypet1','pet-frame').x==200,'sixth entry wraps into the next column')
count=3;ids.party1='P3';ids.party2='P4';ids.party3=nil;ids.partypet1=nil
emit('GROUP_ROSTER_UPDATE');driverTick()
assert(creates==6 and disposals==2,'leaving disposes only the departed member and pet')
assert(at('party1','member-frame')==originalP3 and sources.P3==sourceP3 and sourceP3.target.Token=='party1','GUID survives slot reassignment with the same source object')
assert(at('party1','member-health').attributes.unit=='party1' and at('party1','member-heading').attributes.unit=='party1','secure targets retarget with the retained display')
emit('UNIT_HEALTH','party1')
assert(at('party1','member-health-bar').value==777,'retained event subscription filters the new unit token')
local healPreset=LumaUI.ClickCastPresets:Get(findNode(party.root,'member-health').props.clickCastPreset)
LumaUI.ClickCastPresets:Update(healPreset.id,healPreset.name,'CTRL-SHIFT-BUTTON1',healPreset.bindings[1].spellId)
active=controls.active:get('paladin-party').instance
assert(at('party1','member-health').attributes['ctrl-shift-type1']=='spell' and at('party2','member-health').attributes['ctrl-shift-spell1']==635,'shared preset edits update every copy')
assert(not pcall(function() LumaUI.ClickCastPresets:Delete(healPreset.id) end))
raid=true;count=3;ids={raid1='R1',raid2='R2',raid3='R3',raidpet2='RP2'}
emit('GROUP_ROSTER_UPDATE');driverTick()
assert(not controls.active:get('paladin-party') and controls.active:get('paladin-raid'),'party/raid switches own separate trees')
local raidInstance=controls.active:get('paladin-raid').instance
local function raidAt(guid,id) return assert(raidInstance.Nodes:get('raid/guid:'..guid..'/'..id)) end
local r1,r2=raidAt('R1','member-frame'),raidAt('R2','member-frame')
assert(r2.x==0 and r1.x==200 and raidAt('R3','member-frame').y==-66,'native raid subgroups form adjacent columns')
assert(raidAt('R2','member-pet').attributes.unit=='raidpet2')
local driverCount=0;for _ in pairs(drivers) do driverCount=driverCount+1 end
assert(driverCount==6,'three actual members and inline pet slots, not forty reserved members')
local beforeCreates=creates
raidGroups[2]=2;emit('GROUP_ROSTER_UPDATE')
assert(creates==beforeCreates and raidAt('R1','member-frame')==r1 and raidAt('R2','member-frame')==r2 and raidInstance.Frame.width==192,'group reassignment moves existing cells without source churn')
combat=true;count=4;ids.raid4='R4';raidGroups[4]=2;beforeFrames=#nativeFrames
emit('GROUP_ROSTER_UPDATE')
assert(creates==beforeCreates and #nativeFrames==beforeFrames and not raidInstance.Nodes:get('raid/guid:R4/member-frame'),'combat changes queue without protected allocation')
count=3;ids.raid3='R4';ids.raid4=nil;raidGroups[4]=nil
emit('GROUP_ROSTER_UPDATE')
combat=false;emit('PLAYER_REGEN_ENABLED');driverTick()
assert(raidAt('R1','member-frame')==r1 and raidAt('R2','member-frame')==r2 and not raidInstance.Nodes:get('raid/guid:R3/member-frame'),'combat reconciliation preserves unaffected members')
assert(raidAt('R4','member-health').attributes.unit=='raid3','latest queued roster and secure target agree')
LumaUI.Presets:SetActivation('paladin-raid','never')
raid=false;count=0;class='MAGE';ids={player='P1'}
LumaUI.Presets:SetActivation('paladin-party','always');driverTick()
active=controls.active:get('paladin-party').instance
assert(active and at('player','member-frame').shown and active.Frame.width==192,'manual Always shows self solo and bypasses automatic class/group filters')
LumaUI.Presets:SetActivation('paladin-party','never');assert(next(drivers)==nil,'disable releases visibility and subscriptions')
-- Exercise the same activation path as the editor for both roster scopes.
for _,id in ipairs({'paladin-party','paladin-raid'}) do
 raid=id=='paladin-raid';count=2;class='PALADIN';ids={player='P1',party1='P2',raid1='P1',raid2='P2'}
 local draft=new(__wuiraModules_LumaUI_Editor.require('Draft').EditorDraft)
 LumaUI.Presets:SetActivation(id,'condMet');emit('GROUP_ROSTER_UPDATE');driverTick()
 draft:Open(id);draft:UpdateActivation({enabled='always'});draft:Apply();driverTick()
 assert(LumaUI.Presets:Get(id).enabled=='always',draft.message)
 local before=controls.active:get(id).instance
 raid=false;count=0;ids={player='P1'};emit('GROUP_ROSTER_UPDATE');driverTick()
 local current=assert(controls.active:get(id)).instance
 assert(current==before,'Always retains the roster host after leaving a group')
 local node=assert(current.Nodes:get((id=='paladin-party' and 'party' or 'raid')..'/guid:P1/member-frame'))
 assert(node.shown and current.Frame.width==192 and current.Frame.height>0,'editor Always remains visible solo for '..id)
 LumaUI.Presets:SetActivation(id,'never')
 draft:Open(id);draft:UpdateActivation({enabled='always'});draft:Apply();driverTick()
 assert(controls.active:get(id).instance.Frame.width==192,'editor Always activates an inactive solo roster for '..id)
 LumaUI.Presets:SetActivation(id,'never')
end
local preview=LumaUI.Presets:Preview(party)
preview.Frame=master.require('lua_modules.wuira.lib.index').wuira:Mount(preview.View)
assert(preview.Nodes:get('member-frame') and preview.Nodes:get('pet-frame'),'preview exposes member/pet template aliases')
assert(preview.Nodes:get('member-frame').width==192 and preview.Nodes:get('member-frame').height==52)
assert(next(drivers)==nil and preview.Nodes:get('member-heading').kind=='Frame' and not preview.Nodes:get('member-heading').attributes,'preview class fill never enables secure actions')
preview:Dispose();assert(preview.Nodes.size==0,'preview releases all keyed nodes and aliases')
-- Editing/reopening a built-in component must not restore shipped geometry.
local edited=LumaUI.Presets:Get('paladin-party')
findNode(edited.root,'member-name').props.fontSize=17
findNode(edited.root,'member-health').props.height=41
findNode(edited.root,'member-power').props.height=8
findNode(edited.root,'member-heading').props.backgroundColor={r=.2,g=.3,b=.4}
LumaUI.Presets:Save(edited,false)
local draftClass=__wuiraModules_LumaUI_Editor.require('Draft').EditorDraft
local savedDraft=new(draftClass);savedDraft:Load(edited);savedDraft:Save()
local restoredDraft=new(draftClass)
local restored=restoredDraft:Document()
assert(findNode(restored.root,'member-name').props.fontSize==17 and restored.enabled=='never','saved draft preserves edits and activation')
assert(findNode(restored.root,'member-health').props.height==41 and findNode(restored.root,'member-power').props.height==8,'reopening keeps custom bar heights')
assert(findNode(restored.root,'member-heading').props.backgroundColor.r==.2,'reopening does not replace user styling with built-in defaults')
LumaUI.Presets:Restore()
assert(findNode(LumaUI.Presets:Get('paladin-party').root,'member-power').props.height==8 and LumaUI.Presets:ActivationStatus('paladin-party')=='Disabled','reconciliation preserves custom geometry and manual disable')
hpDef.Create=originalCreate
-- Fixed unit imports mount with independent node trees using the existing factories.
local fixedPlayer=importBuiltin(LumaUI,master,'PlayerUnitFrame')
local fixedTarget=importBuiltin(LumaUI,master,'TargetUnitFrame')
fixedPlayer.enabled='always';fixedPlayer.class=nil
fixedTarget.enabled='always';fixedTarget.class=nil
local mountedPlayer=LumaUI.Presets:Mount(fixedPlayer)
local mountedTarget=LumaUI.Presets:Mount(fixedTarget)
assert(mountedPlayer.Frame~=mountedTarget.Frame)
assert(mountedPlayer.Nodes:get('member-frame').attributes.unit=='player')
assert(mountedTarget.Nodes:get('member-frame').attributes.unit=='target')
mountedPlayer:Dispose()
assert(mountedTarget.Nodes:get('member-frame').attributes.unit=='target')
mountedTarget:Dispose()
__CLICK_CAST_CHECKS__
for _,key in ipairs(apiNames) do _G[key]=old[key] end
originalPrint('Keyed party/raid: GUID reuse, DC/online, join/leave, token retargeting, manual visibility and combat reconciliation passed')
end
