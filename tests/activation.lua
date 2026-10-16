do
 local class,group,raid,reads='PALADIN',0,false,0
 UnitClass=function() reads=reads+1;return 'Paladin',class,2 end
 IsInRaid=function() reads=reads+1;return raid end
 GetNumGroupMembers=function() reads=reads+1;return group end
 local native={activeLayout=1,layouts={{layoutName='Solo',layoutType=1},{layoutName='Raid',layoutType=1}}}
 C_EditMode={GetLayouts=function() return native end}
 local db=new(registry.require('lua_modules.wuira.lib.store.index').StoreRegistry,{addon='LumaUI',variable='ActivationTestDB'})
 local runtime=new(registry.require('builder.Presets').Presets,db)
 local skin=new(registry.require('builder.Skins').Skins,db)
 registry.require('builder.Builtins').registerBuiltins(nil,runtime,skin)
 local creations,disposals,effects,releases=0,0,0,0
 runtime:RegisterSource('tracked',{properties={},Create=function() creations=creations+1;return {progress=new(HP,'player'),Dispose=function() disposals=disposals+1 end} end})
 runtime:RegisterComponent('trackedEffect',{headless=true,children='none',properties={},Apply=function() effects=effects+1;return function() releases=releases+1 end end})
 local function visual(id)
  return {version=1,kind='preset',id=id,name=id,enabled='condMet',class='PALADIN',condition='inParty',
   sources={{name='health',type='tracked',props={}}},root={id='root',type='progress',source='health',props={width=100,height=20}}}
 end
 local d=visual('gated')
 runtime:Save(d,true);runtime:Restore()
 assert(creations==0 and runtime:ActivationStatus('gated')=='Waiting for class, condition or native layout','ineligible sources stay lazy')
 group=3;emit('GROUP_ROSTER_UPDATE')
 assert(creations==1 and runtime:ActivationStatus('gated')=='Active')
 emit('GROUP_ROSTER_UPDATE');assert(creations==1,'unchanged context does not remount')
 group=0;emit('GROUP_ROSTER_UPDATE');assert(disposals==1,'leaving a group disposes sources')
 runtime:SetActivation('gated','never');group=3;emit('GROUP_ROSTER_UPDATE');assert(creations==1)
 local context=new(registry.require('builder.Activation').ActivationContext,runtime.Layouts)
 local before=reads;d.enabled='never';assert(not context:Matches(d) and reads==before,'never skips native condition and class reads')
 d.enabled='always';group=0;before=reads
 assert(context:Matches(d) and reads==before,'manual always skips all automatic filters')
 runtime:SetActivation('gated','always');assert(creations==2)
 class='MAGE';emit('PLAYER_ENTERING_WORLD');assert(disposals==1 and runtime:ActivationStatus('gated')=='Active','always bypasses class guard')
 class='PALADIN';runtime:SetActivation('gated','condMet')
 group=2;combat=true;emit('GROUP_ROSTER_UPDATE');assert(creations==2,'combat activation waits')
 combat=false;emit('PLAYER_REGEN_ENABLED');assert(creations==3)
 group=0;combat=true;emit('GROUP_ROSTER_UPDATE');assert(disposals==2,'combat release waits')
 combat=false;emit('PLAYER_REGEN_ENABLED');assert(disposals==3)
 for field,value in pairs({enabled='automatic',class='ANY',condition='doStuff()',layout='',layoutPositions={bad={x=0,y='bad'}}}) do
  local invalid=visual('bad');invalid[field]=value;assert(not pcall(function() runtime:Validate(invalid) end),'invalid activation metadata: '..field)
 end
 local dep={version=1,kind='preset',id='nested-rule',name='Nested rule',enabled='condMet',condition='inParty',sources={},
  root={id='effect',type='trackedEffect',props={}}}
 runtime:Save(dep,false)
 local parent={version=1,kind='preset',id='parent-rule',name='Parent rule',sources={},root={id='root',type='fragment',props={},children={
  {id='visual',type='cell',props={width=50,height=20}}, {id='rule',type='preset',preset='nested-rule',props={}}}}}
 runtime:Save(parent,true)
 assert(effects==0)
 group=2;emit('GROUP_ROSTER_UPDATE');assert(effects==1,'embedded conditions activate independently of standalone enable state')
 group=0;emit('GROUP_ROSTER_UPDATE');assert(releases==1,'nested gate changes release effects')
 group=2;emit('GROUP_ROSTER_UPDATE');assert(effects==2)
 dep.enabled='never';runtime:Save(dep,false);assert(releases==2 and effects==2,'disabled nested metadata overrides composition')
 local preview=runtime:Preview({version=1,kind='preset',id='preview-never',name='Preview',enabled='never',sources={},root={id='root',type='cell',props={width=50,height=20}}})
 assert(preview.View and effects==2,'preview ignores activation rules without applying headless effects');preview:Dispose()
 local layoutDoc=visual('layout-rule');layoutDoc.condition=nil;layoutDoc.layout='1::Raid'
 runtime:Save(layoutDoc,true);assert(runtime:ActivationStatus('layout-rule')~='Active')
 native.activeLayout=2;emit('EDIT_MODE_LAYOUTS_UPDATED');assert(runtime:ActivationStatus('layout-rule')=='Active')
 native.activeLayout=1;emit('EDIT_MODE_LAYOUTS_UPDATED');assert(runtime:ActivationStatus('layout-rule')~='Active')
 native.activeLayout=2;combat=true;emit('EDIT_MODE_LAYOUTS_UPDATED');assert(runtime:ActivationStatus('layout-rule')~='Active')
 native.activeLayout=1;emit('EDIT_MODE_LAYOUTS_UPDATED');combat=false;emit('PLAYER_REGEN_ENABLED')
 assert(runtime:ActivationStatus('layout-rule')~='Active','latest combat layout wins')
 local imported=runtime:Import(runtime:Export(layoutDoc));assert(imported.layout=='1::Raid' and imported.enabled=='condMet' and imported.class=='PALADIN')
 local positioned={version=1,kind='preset',id='positioned',name='Positioned',sources={},layoutPositions={['1::Solo']={x=12,y=18},['1::Raid']={x=-40,y=25}},
 root={id='root',type='cell',props={width=50,height=20,mode='absolute',anchor='CENTER',x=7,y=8}}}
 runtime:Save(positioned,true)
 assert(runtime.active:get('positioned').View.props.x==12,'native layout position is applied')
 native.activeLayout=2;emit('EDIT_MODE_LAYOUTS_UPDATED')
 assert(runtime.active:get('positioned').View.props.x==-40,'layout switch restores its own position')
 assert(runtime:Get('positioned').root.props.x==7,'base geometry remains intact')
 table.remove(native.layouts,1);native.activeLayout=1;emit('EDIT_MODE_LAYOUTS_UPDATED')
 assert(runtime:ActivationStatus('layout-rule')=='Active' and runtime.Layouts.Active.key=='1::Raid','index shift preserves layout association')
 native.layouts[1].layoutName='Renamed';emit('EDIT_MODE_LAYOUTS_UPDATED')
 assert(runtime:ActivationStatus('layout-rule')~='Active','renamed layouts fail closed until rebound')
 assert(runtime.active:get('positioned').View.props.x==7,'missing position falls back to base geometry')
 for _,item in ipairs(runtime:List()) do runtime:Unmount(item.id) end
 runtime.Layouts:Dispose()
 C_EditMode=nil;UnitClass=nil;IsInRaid=nil;GetNumGroupMembers=nil
 print('Collection activation checks passed')
end
