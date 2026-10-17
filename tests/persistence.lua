local master=__wuiraModules_LumaUI
local loading=true
C_AddOns={IsAddOnLoaded=function(name) if name=='LumaUI_ActionBars' or name=='OtherFeature' then return false,false end;return true,not loading end}
local temporary={};LumaUISettings=temporary;LumaUI=nil
local decodeCalls=0
local decode=C_EncodingUtil.DeserializeCBOR
C_EncodingUtil.DeserializeCBOR=function(value) decodeCalls=decodeCalls+1;return decode(value) end
master.require('index')
assert(LumaUI==nil and next(temporary)==nil,'no stores or UI initialize while the owning addon is loading')
local kept={version=1,kind='preset',id='kept',name='Custom display',owner='LumaUI_ActionBars',enabled='always',sources={},root={id='button',type='secureButton',props={width=77,height=44,unit='player',clickCastPreset='keep-heal',mode='absolute',anchor='CENTER',x=123,y=234}}}
local actual={
 ['lumaui.builder']={version=1,documents={kept},enabled={'preset:kept'}},
 ['lumaui.click-cast-library']={nextId=50,presets={{version=2,kind='clickCast',id='keep-heal',name='Personal heal',bindings={{key='SHIFT-BUTTON1',spellId=635}}}}},
 ['lumaui.collection-bindings']={collections={kept={button='CTRL-H'}}},
 ['lumaui.editor']={version=2,documentId='kept',documentName='My draft',nodes={{id='root',parent='',kind='cell',name='Custom root',width=91,height=54,direction='vertical',props={width=91,height=54}}}},
}
LumaUISettings=actual;loading=false;emit('ADDON_LOADED','LumaUI')
assert(LumaUI and LumaUISettings==actual and next(temporary)==nil,'bootstrap follows the actual SavedVariables table')
assert(#LumaUI.Presets:List()==1 and LumaUI.Presets:Get('kept').root.props.x==123,'no automatic defaults replace saved components')
assert(actual['lumaui.builder'].documents[1].owner==nil,'retired owner is removed from actual SavedVariables')
local foreign={version=1,kind='preset',id='foreign',name='Feature owned',owner='OtherFeature',sources={},root={id='root',type='cell',props={width=20,height=20}}}
LumaUI.Presets:Save(foreign,true);LumaUI.Presets:Restore()
assert(LumaUI.Presets:Get('foreign').owner=='OtherFeature' and LumaUI.Presets:ActivationStatus('foreign')=='Waiting for addon','other addon ownership still gates activation')
LumaUI.Presets:Delete('foreign')
assert(LumaUI.ClickCastPresets:Get('keep-heal').bindings[1].key=='SHIFT-BUTTON1' and LumaUI.Presets:GetBinding('kept','button')=='CTRL-H','bindings and click presets retain user choices')
local draftClass=__wuiraModules_LumaUI_Editor.require('Draft').EditorDraft
local draft=new(draftClass);assert(draft.documentName=='My draft' and draft.nodes[1].width==91,'editor draft is restored')
local changed=LumaUI.Presets:Get('kept');changed.root.props.x=321;LumaUI.Presets:Apply(changed)
assert(actual['lumaui.builder'].documents[1].root.props.x==321 and next(temporary)==nil,'edits commit to the live saved table')
local Registry=master.require('lua_modules.wuira.lib.store.index').StoreRegistry
local second=new(Registry,{addon='LumaUI',variable='LumaUISettings'})
local Settings=master.require('builder.Library').BuilderSettings
assert(second:get(Settings).documents[1].root.props.x==321,'saved changes survive a fresh registry')
second:Dispose()
local wire=LumaUI.BuiltinPresets.PaladinParty
assert(type(wire)=='string' and wire:sub(1,8)=='!LUMA:3!' and decodeCalls==0,'built-in strings are never decoded or installed at startup')
for key,value in pairs(LumaUI.BuiltinPresets) do assert(type(value)=='string','built-in catalog values are strings: '..key) end
local wuira=master.require('lua_modules.wuira.lib.index').wuira
local function click(label)
 for index=#nativeFrames,1,-1 do local frame=nativeFrames[index]
  if frame.fontString and frame.fontString.text==label and frame:IsVisible() then
   local owner=frame.parent
   while owner and owner~=UIParent do
    if owner.kind=='Button' and owner.scripts and owner.scripts.OnClick then owner.scripts.OnClick(owner);return end
    owner=owner.parent
   end
  end
 end
 error('missing built-in control: '..label)
end
local function inputWith(text)
 for index=#nativeFrames,1,-1 do local frame=nativeFrames[index];if frame.kind=='EditBox' and frame:IsVisible() and frame.text==text then return frame end end
end
LumaUI:OpenCustomization('builtin-presets');click('Import · Paladin healer · Party')
assert(inputWith(wire) and decodeCalls>0 and #LumaUI.Presets:List()==1 and #LumaUI.ClickCastPresets:List()==1,'opening a built-in validates its preview without saving or installing dependencies')
click('Close');assert(#LumaUI.Presets:List()==1,'cancel keeps the saved library intact')
click('Import · Paladin healer · Party');click('Import')
assert(#LumaUI.ClickCastPresets:List()==4 and LumaUI.ClickCastPresets:Get('keep-heal').name=='Personal heal','explicit import keeps existing click presets intact')
assert(LumaUI.Presets:ActivationStatus('paladin-party')=='Disabled','manual built-in imports start disabled')
assert(LumaUI.Presets:Get('kept').root.props.x==321 and LumaUI.Presets:GetBinding('kept','button')=='CTRL-H','builtin import preserves personal layout and keys')
click('Import · Paladin healer · Party');click('Import')
assert(inputWith(wire) and #LumaUI.Presets:List()==2 and #LumaUI.ClickCastPresets:List()==4,'a duplicate ID cannot overwrite a saved component or create extra click dependencies')
click('Close');LumaUI:CloseCustomization()
assert(LumaUI.BuiltinPresets.PaladinParty==wire,'import never mutates the built-in string')
local remove=LumaUI:RegisterBuiltinPreset({key='TestBuiltin',name='Test',kind='preset',importString=wire})
assert(LumaUI.BuiltinPresets.TestBuiltin==wire and #LumaUI.Presets:List()==2,'extensions register only strings without installing them')
assert(not pcall(function() LumaUI:RegisterBuiltinPreset({key='TestBuiltin',name='Duplicate',kind='preset',importString=wire}) end))
assert(not pcall(function() LumaUI:RegisterBuiltinPreset({key='Factory',name='Factory',kind='preset',importString=wire,Create=function() error('must never run') end}) end),'factory callbacks are not accepted by the catalog')
remove();assert(LumaUI.BuiltinPresets.TestBuiltin==nil and LumaUI.BuiltinPresets.PaladinParty==wire)
local transfer=new(master.require('builder.PresetTransfer').PresetTransfer,LumaUI)
local another=transfer:Decode(wire,'preset');transfer:PrepareClickCast(another)
assert(#LumaUI.ClickCastPresets:List()==4,'reimporting equivalent dependencies does not duplicate mappings')
local copyIdentity=LumaUI.Presets:Identity('Paladin healer · Party')
LumaUI:OpenCustomization('builtin-presets');click('Import · Paladin healer · Party');click('Import copy')
assert(LumaUI.Presets:Get(copyIdentity.id) and LumaUI.Presets:Get('paladin-party'),'copy import keeps the original')
assert(LumaUI.Presets:ActivationStatus(copyIdentity.id)=='Disabled','copies start disabled')
assert(#LumaUI.ClickCastPresets:List()==4,'copies reuse equivalent click presets')
local nextCopy=LumaUI.Presets:Identity('Paladin healer · Party')
click('Import · Paladin healer · Party');click('Import copy')
assert(LumaUI.Presets:Get(nextCopy.id),'repeated copies use unique IDs')
LumaUI:CloseCustomization()
originalPrint('Persistence and optional starter imports passed')
