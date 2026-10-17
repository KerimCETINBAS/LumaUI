local master=__wuiraModules_LumaUI
C_AddOns={IsAddOnLoaded=function() return true,true end}
SettingsPanel=CreateFrame('Frame',nil,UIParent)
Settings={RegisterCanvasLayoutCategory=function() return {GetID=function() return 9 end} end,RegisterAddOnCategory=function() end}
Minimap=CreateFrame('Frame',nil,UIParent);Minimap:SetSize(140,140)
function UnitGUID(unit) return 'GUID-'..unit end
local payloads={}
C_EncodingUtil={SerializeCBOR=function(value)payloads[#payloads+1]=value;return tostring(#payloads)end,DeserializeCBOR=function(value)return payloads[tonumber(value)]end,CompressString=function(v)return v end,DecompressString=function(v)return v end,EncodeBase64=function(v)return v end,DecodeBase64=function(v)return v end}
LumaUISettings={};SlashCmdList={};master.require('index')
local library=LumaUI.ClickCastPresets
local unitButton=master.require('builder.UnitButton')
local oldSubtext=C_Spell.GetSpellSubtext
C_Spell.GetSpellSubtext=function(id) if id==635 then return 'Rank 1' end end
local friendly=library:Create('Friendly',{{key='BUTTON1',spellId=635}}, {onlyTarget=true,friendly=true,enemy=false})
assert(not pcall(function() library:Create('Nobody',{{key='BUTTON1',spellId=635}},{onlyTarget=false,friendly=false,enemy=false}) end))
assert(not pcall(function() library:Create('Wrong type',{{key='BUTTON1',spellId=635}},{friendly='true'}) end))
assert(not pcall(function() library:Create('Macro strict',{{key='BUTTON1',macro='Own targeting'}},{onlyTarget=true,friendly=true,enemy=true}) end),'arbitrary macros cannot promise clicked-unit targeting')
local cloned=library:Get(friendly.id);cloned.bindings[1].traits.enemy=true
assert(not library:Get(friendly.id).bindings[1].traits.enemy,'returned traits cannot change saved presets')
library:Update(friendly.id,'Friendly',{{key='BUTTON1',spellId=635}})
assert(library:Get(friendly.id).bindings[1].traits.onlyTarget,'compatibility updates preserve target traits')
local target=new(master.require('lua_modules.wuira.lib.datasources.UnitSource').UnitSource,'party1')
local frame=CreateFrame('Button',nil,UIParent,'SecureActionButtonTemplate')
local stop=unitButton.configureUnitButton(nil,frame,target,friendly)
assert(frame.attributes.type1=='' and frame.attributes.helpbutton1=='luma1' and frame.attributes.harmbutton1=='')
assert(frame.attributes['type-luma1']=='macro' and frame.attributes['unit-luma1']=='party1')
assert(frame.attributes['macrotext-luma1']=='/stopspelltarget [@mouseover,exists,help] \n/cast [@mouseover,exists,help] Spell 635(Rank 1)','one explicit unit clause with no self/target fallback and preserved rank')
assert(frame.attributes.type2=='togglemenu','unmapped standard context menu remains available')
-- Native help/harm remapping chooses a virtual action; neutral/disallowed units retain the empty action.
local function action(attributes,disposition,prefix)
 prefix=prefix or ''
 local remap=disposition=='friendly' and 'helpbutton1' or disposition=='enemy' and 'harmbutton1' or nil
 local mapped=remap and (attributes[prefix..remap] or attributes[remap])
 if mapped=='' then mapped=nil end
 local suffix=mapped and '-'..mapped or '1'
 local value=attributes[prefix..'type'..suffix] or attributes['type'..suffix]
 return value~='' and value or nil
end
combat=true
assert(action(frame.attributes,'friendly')=='macro' and action(frame.attributes,'enemy')==nil and action(frame.attributes,'neutral')==nil,'click policy is evaluated without combat-time attribute mutation')
combat=false
target:Retarget('party2')
assert(frame.attributes['macrotext-luma1']=='/stopspelltarget [@mouseover,exists,help] \n/cast [@mouseover,exists,help] Spell 635(Rank 1)' and frame.attributes['unit-luma1']=='party2','stable frames follow safe roster retargeting')
stop()
assert(next(frame.attributes)==nil,'all physical, virtual, unit and macro attributes are removed')
local enemy=library:Create('Enemy',{{key='CTRL-SHIFT-BUTTON1',spellId=20271}},{onlyTarget=false,friendly=false,enemy=true})
local stopEnemy=unitButton.configureUnitButton(nil,frame,'target',enemy)
assert(action(frame.attributes,'enemy','ctrl-shift-')=='spell' and action(frame.attributes,'friendly','ctrl-shift-')==nil)
assert(frame.attributes['ctrl-shift-spell-luma1']==20271 and frame.attributes.type1=='target','enemy restriction does not replace standard selection')
stopEnemy()
local both=library:Create('Both',{{key='BUTTON1',spellId=635}},{onlyTarget=false,friendly=true,enemy=true})
local stopBoth=unitButton.configureUnitButton(nil,frame,'party1',both)
assert(frame.attributes.type1=='spell' and frame.attributes.spell1==635 and frame.attributes.helpbutton1=='','unrestricted presets retain native spell behavior')
stopBoth()

local mixed=library:Create('Mixed policy',{
 {key='BUTTON1',spellId=635,targeting='mouseover',traits={onlyTarget=false,friendly=true,enemy=false,nodead=true,clearTargeting=true}},
 {key='SHIFT-BUTTON1',spellId=20271,targeting='direct',traits={onlyTarget=true,friendly=false,enemy=true}},
 {key='CTRL-BUTTON1',spellId=2006,targeting='mouseover',traits={onlyTarget=true,friendly=true,enemy=false,nodead=false,clearTargeting=false}},
 {key='BUTTON4',itemId=3385,targeting='mouseover',traits={onlyTarget=true,friendly=true,enemy=true,nodead=true,clearTargeting=false}},
 {key='BUTTON5',macro='Own targeting',targeting='direct'},
 {key='ALT-BUTTON1',spellId=19750,targeting='direct',traits={onlyTarget=false,friendly=true,enemy=true}}
})
assert(mixed.traits==nil and mixed.bindings[1].traits.onlyTarget and not mixed.bindings[2].traits.onlyTarget,'canonical policies belong to bindings; explicit mode wins over legacy alias')
frame:SetAttribute('macro-luma1','Stale macro')
frame:SetAttribute('spell-luma1',999)
local stopMixed=unitButton.configureUnitButton(nil,frame,'party1',mixed)
assert(frame.attributes['macro-luma1']==nil and frame.attributes['spell-luma1']==nil,'stale action attributes cannot override generated macrotext')
assert(frame.attributes['macrotext-luma1']=='/stopspelltarget [@mouseover,exists,nodead,help] \n/cast [@mouseover,exists,nodead,help] Spell 635(Rank 1)')
assert(frame.attributes['shift-type-luma1']=='spell' and frame.attributes['shift-spell-luma1']==20271 and frame.attributes['shift-harmbutton1']=='luma1' and frame.attributes['shift-helpbutton1']=='','direct enemy action is independent of friendly heal')
assert(action(frame.attributes,'enemy','shift-')=='spell' and action(frame.attributes,'friendly','shift-')==nil,'a disallowed modified action cannot inherit the unmodified friendly remap')
assert(frame.attributes['ctrl-macrotext-luma1']=='/cast [@mouseover,exists,help] Spell 2006','resurrection can target dead units without clearing targeting')
assert(frame.attributes.macrotext4=='/use [@mouseover,exists,nodead] item:3385' and frame.attributes.macro5=='Own targeting','items share guarded targeting; named macros retain their body')
assert(action(frame.attributes,'friendly','alt-')=='spell' and action(frame.attributes,'enemy','alt-')=='spell','an unrestricted modified action also blocks base remap inheritance')
combat=true
assert(frame.attributes['macrotext-luma1']:find('@mouseover',1,true) and not frame.attributes['macrotext-luma1']:find('@player',1,true),'combat uses preconfigured mouseover macros with no self fallback')
combat=false
stopMixed()
assert(next(frame.attributes)==nil,'mixed policies clean every physical and virtual attribute')
library:Update(mixed.id,'Mixed policy',{{key='button1',spellId=19750},{key='SHIFT-BUTTON1',spellId=20271}})
local changed=library:Get(mixed.id)
assert(changed.bindings[1].targeting=='mouseover' and changed.bindings[1].traits.nodead and changed.bindings[2].targeting=='direct','compatibility updates preserve policy per canonical combination')
assert(not pcall(function() library:Create('Invalid mode',{{key='BUTTON1',spellId=635,targeting='whatever'}}) end))
assert(not pcall(function() library:Create('Invalid alive',{{key='BUTTON1',spellId=635,traits={onlyTarget=true,friendly=true,enemy=true,nodead='true'}}}) end))
assert(not pcall(function() library:Create('Mixed invalid macro',{{key='BUTTON1',macro='Own targeting',targeting='mouseover'}}) end))
local legacy=library:Validate({version=2,kind='clickCast',id='legacy-traits',name='Legacy',traits={onlyTarget=true,friendly=true,enemy=false},bindings={{key='BUTTON1',spellId=635},{key='SHIFT-BUTTON1',spellId=19750}}})
assert(legacy.traits==nil and legacy.bindings[1].targeting=='mouseover' and legacy.bindings[2].traits.enemy==false,'preset-level legacy traits migrate into every binding')

local transfer=new(master.require('builder.PresetTransfer').PresetTransfer,LumaUI)
local doc={version=1,kind='preset',id='traits-test',name='Traits test',sources={},root={id='button',type='secureButton',props={width=24,height=24,unit='party1',clickCastPreset=friendly.id}}}
local payload=transfer:Decode(transfer:Export(doc),'preset')
assert(payload.clickCastPresets[1].bindings[1].traits.onlyTarget and not payload.clickCastPresets[1].bindings[1].traits.enemy,'target policy survives export and decode')
local count=#library:List();transfer:PrepareClickCast(payload);assert(#library:List()==count,'equivalent bindings and traits reuse the saved preset')
payload=transfer:Decode(transfer:Export(doc),'preset');payload.clickCastPresets[1].bindings[1].traits.enemy=true
transfer:PrepareClickCast(payload)
assert(#library:List()==count+1 and payload.document.root.props.clickCastPreset~=friendly.id,'different traits cannot be merged during import')
local Registry=master.require('lua_modules.wuira.lib.store.index').StoreRegistry
local Library=master.require('builder.ClickCastLibrary').ClickCastLibrary
local registry=new(Registry,{addon='LumaUI',variable='LumaUISettings'})
local reloaded=new(Library,registry,function()end,function()return false end)
assert(reloaded:Get(friendly.id).bindings[1].traits.onlyTarget and not reloaded:Get(friendly.id).bindings[1].traits.enemy,'traits survive a new store registry')
registry:Dispose()

local originalPayload=transfer:Decode(transfer:Export(doc),'preset')
for _,change in ipairs({
 function(b) b.targeting='direct' end,
 function(b) b.traits.nodead=true end,
 function(b) b.traits.clearTargeting=false end
}) do
 local changedPayload=transfer:Decode(transfer:Export(doc),'preset')
 change(changedPayload.clickCastPresets[1].bindings[1])
 transfer:PrepareClickCast(changedPayload)
 assert(changedPayload.document.root.props.clickCastPreset~=friendly.id,'different transport/alive/clear policy cannot reuse another preset')
end
_G.LumaClickPolicySettings={['lumaui.click-cast-library']={nextId=71,presets={{version=2,kind='clickCast',id='old-policy',name='Old policy',traits={onlyTarget=true,friendly=true,enemy=false},bindings={{key='BUTTON1',spellId=635},{key='SHIFT-BUTTON1',spellId=19750}}}}}}
local migratedRegistry=new(Registry,{addon='LumaUI',variable='LumaClickPolicySettings'})
local migrated=new(Library,migratedRegistry,function()end,function()return false end)
local savedPolicy=LumaClickPolicySettings['lumaui.click-cast-library'].presets[1]
assert(savedPolicy.id=='old-policy' and savedPolicy.traits==nil and savedPolicy.bindings[1].targeting=='mouseover' and savedPolicy.bindings[2].traits.enemy==false,'actual saved preset-level policies migrate without replacing identity or preferences')
assert(migrated:Create('Next id','BUTTON1',635).id=='click-cast-71','migration preserves next ID allocation')
migratedRegistry:Dispose();_G.LumaClickPolicySettings=nil

C_Spell.GetSpellSubtext=oldSubtext
local listDoc={version=1,kind='preset',id='static-list',name='Static list',sources={{name='records',type='list',props={items={{key='one'},{key='two'}}}}},root={id='rows',type='foreach',source='records',props={direction='vertical',gap=0},children={{id='cell',type='cell',props={width=20,height=10}}}}}
local list=LumaUI.Presets:Preview(listDoc)
assert(list.Nodes.size==0 and list.View~=nil,'generic list is lazy until mounted')
local ui=master.require('lua_modules.wuira.lib.index').wuira
local mounted=ui:Mount(list.View)
assert(list.Nodes:get('rows/one/cell') and list.Nodes:get('rows/two/cell'),'static records use stable keys in the same repeated-template pipeline')
ui:Unmount(mounted);list:Dispose()
listDoc.sources[1].props.items[2].key='one'
assert(not pcall(function() LumaUI.Presets:Validate(listDoc) end),'duplicate static keys are rejected before mounting')

-- Mount the real capture field and drive its native input handlers.
local capture=master.require('builder.ClickBindingInput')
local previousShift,previousCtrl,previousAlt=IsShiftKeyDown,IsControlKeyDown,IsAltKeyDown
local shift,ctrl,alt=false,false,false
IsShiftKeyDown=function() return shift end
IsControlKeyDown=function() return ctrl end
IsAltKeyDown=function() return alt end
local changed={}
local captureView=ui:Mount(capture.ClickBindingInput(nil,{width=280,value='BUTTON1',colors=LumaUI.Theme.colors,onChange=function(_,key) changed[#changed+1]=key end}))
local input
for i=#nativeFrames,1,-1 do if nativeFrames[i].kind=='EditBox' then input=nativeFrames[i];break end end
assert(input.text=='Left click' and not input.focused,'unfocused capture displays compact human-readable binding')
input.scripts.OnMouseDown(input,'LeftButton')
assert(#changed==0 and input.focused and input.text:find('Press mouse',1,true),'activation click only focuses; it never overwrites the binding')
shift,ctrl,alt=true,true,true
input.scripts.OnMouseDown(input,'Button4')
assert(changed[1]=='ALT-CTRL-SHIFT-BUTTON4' and input.text=='Alt + Ctrl + Shift + Mouse 4' and not input.focused,'held modifiers are captured in native canonical order')
shift,ctrl,alt=false,false,false
input.scripts.OnMouseDown(input,'LeftButton')
input.scripts.OnKeyDown(input,'A')
assert(#changed==1 and input.propagate==false and input.text:find('Use mouse',1,true),'unsupported keyboard keys do not create invalid click-cast bindings or reach gameplay')
input.scripts.OnKeyDown(input,'ESCAPE')
assert(#changed==1 and not input.focused and input.text=='Alt + Ctrl + Shift + Mouse 4','Escape retains the previous binding')
input.scripts.OnMouseDown(input,'LeftButton')
input.scripts.OnKeyDown(input,'LSHIFT')
assert(#changed==1 and input.focused,'a modifier alone does not commit')
input.scripts.OnMouseDown(input,'MiddleButton')
assert(changed[2]=='BUTTON3' and input.text=='Middle click')
input.scripts.OnMouseDown(input,'LeftButton')
input.scripts.OnKeyDown(input,'DELETE')
assert(changed[3]=='' and input.text=='Click to bind','Delete clears the draft binding')
input:SetText('CTRL-BUTTON5')
assert(input.text=='Click to bind' and #changed==3,'pasting text cannot bypass capture or enter an invalid combination')
input.scripts.OnMouseDown(input,'LeftButton')
input.scripts.OnEditFocusLost(input)
assert(input.text=='Click to bind' and #changed==3,'losing focus cancels unfinished capture')
input.scripts.OnMouseDown(input,'LeftButton')
input.scripts.OnMouseDown(input,'Button5')
assert(changed[4]=='BUTTON5' and input.text=='Mouse 5')
input.scripts.OnMouseDown(input,'LeftButton')
input.scripts.OnHide(input)
assert(not input.focused and input.text=='Mouse 5','hiding the page cancels capture without changing the draft')
input.scripts.OnMouseDown(input,'LeftButton')
ui:Unmount(captureView)
assert(not input.focused and not input.scripts.OnKeyDown and not input.scripts.OnMouseDown and not input.scripts.OnTextChanged,'unmount clears capture and all native listeners')
IsShiftKeyDown,IsControlKeyDown,IsAltKeyDown=previousShift,previousCtrl,previousAlt

print('Click Cast target traits passed')
