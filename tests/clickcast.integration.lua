do
 local library=LumaUI.ClickCastPresets
 local preset=library:Create('Multi heal',{{key='button1',spellId=635},{key='shift-button1',spellId=19750},{key='CTRL-BUTTON2',spellId=1152},{key='ALT-BUTTON4',itemId=3385},{key='SHIFT-BUTTON2',macro=' Heal mouseover '}})
 assert(preset.version==2 and #preset.bindings==5 and preset.bindings[2].key=='SHIFT-BUTTON1')
 preset.bindings[1].spellId=1
 assert(library:Get(preset.id).bindings[1].spellId==635,'returned binding lists cannot mutate saved presets')
 assert(not pcall(function() library:Create('Duplicate',{{key='shift-ctrl-button1',spellId=635},{key='CTRL-SHIFT-BUTTON1',spellId=19750}}) end),'canonical modifier combinations must be unique within one preset')
 assert(not pcall(function() library:Create('Empty',{}) end))
 assert(not pcall(function() library:Create('Invalid',{{key='BUTTON1',spellId=1.5}}) end))
 assert(not pcall(function() library:Create('Secret',{{key='BUTTON1',spellId={secret=true}}}) end))
 local another=library:Create('Other buttons',{{key='BUTTON1',spellId=19740}})
 assert(another.bindings[1].key=='BUTTON1','different presets may share a mouse combination')
 local document={version=1,kind='preset',id='multi-click-test',name='Multi click test',sources={},root={id='root',type='flow',props={width=64,height=32,direction='horizontal'},children={
  {id='a',type='secureButton',props={width=32,height=32,unit='player',clickCastPreset=preset.id}},
  {id='b',type='secureButton',props={width=32,height=32,unit='player',clickCastPreset=preset.id}}
 }}}
 LumaUI.Presets:Apply(document)
 local instance=controls.active:get(document.id).instance
 local original=instance.Nodes:get('a')
 for _,id in ipairs({'a','b'}) do
  local frame=instance.Nodes:get(id)
  assert(frame.attributes.type1=='spell' and frame.attributes.spell1==635 and frame.attributes.type2=='togglemenu')
  assert(frame.attributes['alt-type4']=='item' and frame.attributes['alt-item4']=='item:3385' and frame.attributes['shift-type2']=='macro' and frame.attributes['shift-macro2']==' Heal mouseover ','equipped/consumable items and named macros use their native secure action types')
  assert(frame.attributes['shift-type1']=='spell' and frame.attributes['shift-spell1']==19750 and frame.attributes['ctrl-spell2']==1152,'one preset applies all combinations to every attached button')
 end
 combat=true
 assert(not pcall(function() library:Update(preset.id,'Blocked',{{key='BUTTON2',spellId=1022}}) end))
 assert(not pcall(function() library:Create('Blocked',{{key='BUTTON1',spellId=635}}) end))
 assert(not pcall(function() library:Delete(another.id) end))
 combat=false
 library:Update(preset.id,'Multi heal',{{key='BUTTON2',spellId=1152},{key='ALT-BUTTON3',spellId=1044}})
 instance=controls.active:get(document.id).instance
 for _,id in ipairs({'a','b'}) do
  local frame=instance.Nodes:get(id)
  assert(frame.attributes.type1=='target' and frame.attributes.type2=='spell' and frame.attributes.spell2==1152,'unmapped clicks restore standard actions')
  assert(frame.attributes['alt-spell3']==1044 and not frame.attributes['shift-type1'] and not frame.attributes['ctrl-spell2'],'removed mappings do not survive preset edits')
 end
 assert(not original.attributes['alt-item4'] and not original.attributes['shift-macro2'],'item and macro attributes are cleaned on replacement')
 assert(not original.shown and not original.attributes.spell1 and not original.attributes['shift-spell1'] and not original.attributes['ctrl-spell2'],'old secure frames release every custom attribute')
 assert(not pcall(function() library:Delete(preset.id) end),'an attached shared preset cannot be deleted')
 LumaUI.Presets:Delete(document.id);library:Delete(preset.id);library:Delete(another.id)
 assert(LumaUI.StandardClickPreset.immutable and LumaUI.StandardClickPreset.actions[2].action=='togglemenu')
 local Registry=master.require('lua_modules.wuira.lib.store.index').StoreRegistry
 local Library=master.require('builder.ClickCastLibrary').ClickCastLibrary
 _G.LumaClickCastTestSettings={['lumaui.click-cast-library']={nextId=9,presets={{version=1,kind='clickCast',id='old',name='Old healer',key='shift-ctrl-button1',spellId=635}}}}
 local registry=new(Registry,{addon='LumaUI',variable='LumaClickCastTestSettings'})
 local migrated=new(Library,registry,function() end,function() return false end)
 local old=migrated:Get('old')
 assert(old.version==2 and old.name=='Old healer' and old.bindings[1].key=='CTRL-SHIFT-BUTTON1' and old.bindings[1].spellId==635)
 local saved=LumaClickCastTestSettings['lumaui.click-cast-library'].presets[1]
 assert(saved.version==2 and saved.key==nil and saved.spellId==nil,'legacy records are migrated in SavedVariables with the same ID')
 assert(migrated:Create('Compatibility','BUTTON1',635).id=='click-cast-9','migration preserves identity allocation and one-binding shorthand')
 local multiple=migrated:Create('Persisted multi',{{key='BUTTON1',spellId=635},{key='SHIFT-BUTTON1',spellId=19750}})
 registry:Dispose()
 registry=new(Registry,{addon='LumaUI',variable='LumaClickCastTestSettings'})
 migrated=new(Library,registry,function() end,function() return false end)
 assert(#migrated:Get(multiple.id).bindings==2 and migrated:Get(multiple.id).bindings[2].spellId==19750,'multiple bindings survive a new registry and reload')
 registry:Dispose();_G.LumaClickCastTestSettings=nil
 -- Render the real page with a small refresh host, including native text boxes.
 local page,view,needsRefresh
 local fake=setmetatable({RegisterPage=function(_,value) page=value end,RefreshCustomization=function() needsRefresh=true end},{__index=LumaUI})
 master.require('builder.ClickCastLibraryView').installClickCastLibrary(nil,fake)
 local wuira=master.require('lua_modules.wuira.lib.index').wuira
 local function render()
  if needsRefresh==false then return end
  needsRefresh=false
  local next=wuira:Mount(page:Render({width=900,height=620}));if view then wuira:Unmount(view) end;view=next
 end
 local function click(label)
  for i=#nativeFrames,1,-1 do local frame=nativeFrames[i]
   if frame.fontString and frame.fontString.text==label and frame:IsVisible() then
    local owner=frame.parent
    while owner and owner~=UIParent do
     if owner.kind=='Button' and owner.scripts and owner.scripts.OnClick then owner.scripts.OnClick(owner);render();return end
     owner=owner.parent
    end
   end
  end
  error('missing Click Cast control '..label)
 end
 local function inputs()
  local result={};for _,frame in ipairs(nativeFrames) do if frame.kind=='EditBox' and frame:IsVisible() then result[#result+1]=frame end end
  return result
 end
 render()
 local fields=inputs();assert(#fields==2,'spell IDs are never typed by the user')
 fields[1]:SetText('Multi UI');fields[2]:SetText('BUTTON1')
 click('Choose action...');click('Spell 20271')
 click('Add binding');fields=inputs()
 assert(#fields==3 and fields[1].text=='Multi UI','opening the picker and adding a row preserve typed fields')
 fields[3]:SetText('SHIFT-BUTTON1')
 click('Choose action...');local search=inputs();search=search[#search];search:SetText('26573');search.scripts.OnTextChanged(search)
 click('Spell 26573');click('Save preset')
 local uiPreset;for _,item in ipairs(library:List()) do if item.name=='Multi UI' then uiPreset=item end end
 assert(uiPreset and #uiPreset.bindings==2 and uiPreset.bindings[1].spellId==20271 and uiPreset.bindings[2].spellId==26573,'the native picker saves selected IDs for all rows')
 click('X');click('Save preset');assert(#library:Get(uiPreset.id).bindings==1,'removing a row persists the shortened preset')
 click('Add binding');fields=inputs();fields[3]:SetText('button1');click('Choose action...');click('Spell 679');click('Save preset')
 assert(#library:Get(uiPreset.id).bindings==1 and #inputs()==3,'conflicting edits preserve both saved data and the draft')
 click('Spell 679');click('Macros');click('Cancel')
 wuira:Unmount(view);library:Delete(uiPreset.id)
 originalPrint('Click Cast: multiple mappings, migration, validation, shared updates, cleanup, combat and native editor checks passed')
end
