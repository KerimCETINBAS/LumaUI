
local registry=__wuiraModules_LumaUI
C_AddOns={IsAddOnLoaded=function() return true end}
local store=new(registry.require('lua_modules.wuira.lib.store.index').StoreRegistry,{addon='LumaUI',variable='BuilderTestDB'})
local presets=new(registry.require('builder.Presets').Presets,store)
local skins=new(registry.require('builder.Skins').Skins,store)
registry.require('builder.Builtins').registerBuiltins(nil,presets,skins)
assert(#presets:ComponentTypes()==10 and #presets:SourceTypes()==10)
assert(#skins:TargetTypes()==3)
local created,disposed=0,0
local HP=registry.require('lua_modules.wuira.lib.datasources.Resources').HP
local stopSource=presets:RegisterSource('counted',{properties={},Create=function()
 created=created+1;return {progress=new(HP,'player'),Dispose=function() disposed=disposed+1 end}
end})
presets:RegisterSource('unused',{properties={},Create=function() error('unused sources must stay lazy') end})
local function doc()
 return {version=1,kind='preset',id='resources',name='Resources',sources={{name='health',type='counted',props={}},{name='unused',type='unused',props={}}},root={id='root',type='flow',props={width=220,height=80,gap=0},children={
  {id='a',type='progress',source='health',props={width='inherit',height=24,color={r=.1,g=.8,b=.4}}},
  {id='b',type='progress',source='health',props={width='inherit',height=24}}
 }}}
end
local playerDocument=registry.require('builder.PlayerCollection').createPlayerCollection(nil,{x=11,y=22})
assert(presets:Validate(playerDocument).root.props.x==11,'player starter is a preset document')
local observed=0
local stopObserve=presets:ObserveMount(function(_,document,instance)
 if document.id=='player' then assert(instance.Nodes:get('healthBar') and instance.Nodes:get('manaBar'));observed=observed+1 end
end)
local playerInstance=presets:Mount(playerDocument)
assert(playerInstance.Frame.shown and observed==1,'player collection mounts through the common runtime')
presets:Unmount('player');stopObserve()
local value=doc()
local built=presets:Create(value)
assert(created==1 and built.View.children[1].source==built.View.children[2].source,'one source per document name')
built:Dispose();built:Dispose();assert(disposed==1,'idempotent source ownership')
local live=presets:Mount(value)
assert(live.Frame.shown and created==2)
local previous=live.Frame
local duplicate=doc();duplicate.root.children[2].id='a'
assert(not pcall(function() presets:Mount(duplicate) end) and previous.shown,'invalid update keeps live view')
local invalid=doc();invalid.root.props.onMount=function() end
assert(not pcall(function() presets:Validate(invalid) end),'never import callbacks')
invalid=doc();invalid.root.children[1].props.color.r=2
assert(not pcall(function() presets:Validate(invalid) end),'property schema')
invalid=doc();invalid.root.type='cell'
assert(not pcall(function() presets:Validate(invalid) end),'single child invariant')
invalid=doc();invalid.root.children[1].source='missing'
assert(not pcall(function() presets:Validate(invalid) end),'source references')
invalid=doc();invalid.root.children[1].children={invalid.root}
assert(not pcall(function() presets:Validate(invalid) end),'cycle guard')
invalid=doc();invalid.version=99
assert(not pcall(function() presets:Validate(invalid) end),'version guard')
invalid=doc();invalid.kind='skin'
assert(not pcall(function() presets:Validate(invalid) end),'separate entry points')
invalid=doc();invalid.root.children[1].type='icon'
invalid.root.children[1].props={}
assert(not pcall(function() presets:Create(invalid) end) and disposed==2,'failed construction disposes its sources')
combat=true
assert(not pcall(function() presets:Mount(value) end),'combat mount rejected')
presets:Unmount('resources');assert(previous.shown and disposed==2,'cleanup waits for combat')
combat=false;emit('PLAYER_REGEN_ENABLED');assert(not previous.shown and disposed==3)
presets:Save(value,true)
value.root.props.width=999
assert(presets:Get('resources').root.props.width==220,'save is detached')
local saved=presets:Get('resources');saved.root.props.width=555
assert(presets:Get('resources').root.props.width==220,'get is detached')
local reloaded=new(registry.require('builder.Presets').Presets,store)
registry.require('builder.Builtins').registerBuiltins(nil,reloaded,new(registry.require('builder.Skins').Skins,store))
reloaded:RegisterSource('counted',{properties={},Create=function() return {progress=new(HP,'player')} end})
reloaded:RegisterSource('unused',{properties={},Create=function() error('unused') end})
reloaded:Restore();reloaded:Delete('resources');assert(#reloaded:List()==0,'enabled documents restore and delete')
local native=CreateFrame('Frame',nil,UIParent);native.alpha=1;native.events.NATIVE=true;native.action=635
local applied=0
skins:RegisterTarget('playerTest',{properties={alpha={type='number',min=0,max=1}},Apply=function(_,props)
 local before=native.alpha;applied=applied+1;native.alpha=props.alpha
 return function() native.alpha=before end
end})
local skin={version=1,kind='skin',id='native',name='Native',targets={{target='playerTest',props={alpha=.5}}}}
local handle=skins:Apply(skin)
assert(native.alpha==.5 and native.events.NATIVE and native.action==635,'skin touches existing target only')
local other={version=1,kind='skin',id='other',name='Other',targets={{target='playerTest',props={alpha=.8}}}}
assert(not pcall(function() skins:Apply(other) end),'one owner per native target')
combat=true
assert(not pcall(function() skins:Apply(skin) end));handle:Dispose();assert(native.alpha==.5)
combat=false;emit('PLAYER_REGEN_ENABLED');assert(native.alpha==1)
local bad={version=1,kind='skin',id='bad',name='Bad',targets={{target='SomeArbitraryGlobal',props={}}}}
assert(not pcall(function() skins:Validate(bad) end),'native targets must be registered')
local tokens,steps={},{}
C_EncodingUtil={
 SerializeCBOR=function(data) steps[#steps+1]='serialize';tokens.payload=data;return 'cbor' end,
 CompressString=function(data) assert(data=='cbor');steps[#steps+1]='compress';return 'compressed' end,
 EncodeBase64=function(data) assert(data=='compressed');steps[#steps+1]='encode';return 'encoded' end,
 DecodeBase64=function(data) steps[#steps+1]='decode';if data=='encoded' then return 'compressed' end end,
 DecompressString=function(data) assert(data=='compressed');steps[#steps+1]='decompress';return 'cbor' end,
 DeserializeCBOR=function(data) assert(data=='cbor');steps[#steps+1]='deserialize';return tokens.payload end,
}
local encoded=presets:Export(doc())
assert(encoded=='!LUMA:1!encoded')
local decoded=presets:Import('  '..encoded..'  ')
assert(decoded.kind=='preset' and decoded.root.children[1].source=='health')
assert(table.concat(steps,',')=='serialize,compress,encode,decode,decompress,deserialize')
assert(not pcall(function() skins:Import(encoded) end),'skin import refuses preset payload')
assert(not pcall(function() presets:Import('!LUMA:2!encoded') end))
assert(not pcall(function() presets:Import('!LUMA:1!broken') end))
local Encoding=registry.require('lua_modules.wuira.lib.platform.Encoding').Encoding
assert(not pcall(function() Encoding:Decode(string.rep('x',21),20) end))
C_EncodingUtil.DecompressString=function() return string.rep('x',21) end
assert(not pcall(function() Encoding:Decode('encoded',20) end))
local TextInput=registry.require('lua_modules.wuira.lib.ui.TextInput').TextInput
local input=new(TextInput,native,{text='hello',maxBytes=100})
assert(input.Value=='hello' and input.Frame.maxBytes==100 and not input.Frame.autoFocus)
input:Focus(true);assert(input.Frame.focused and input.Frame.highlighted)
input:Dispose();input:Dispose();assert(not input.Frame.focused and not input.Frame.shown)
-- Headless effects activate on Mount only, share ownership, and clean up atomically.
local effects, releases=0,0
presets:RegisterComponent('effectTest',{headless=true,children='none',properties={},Apply=function()
 effects=effects+1;return function() releases=releases+1 end
end})
presets:RegisterComponent('failingEffect',{headless=true,children='none',properties={},Apply=function() error('effect failure') end})
local function headless(id,kind)
 return {version=1,kind='preset',id=id,name=id,sources={},root={id='root',type=kind or 'effectTest',props={}}}
end
local effect=headless('effect')
local preview=presets:Preview(effect);assert(preview.View==nil and preview.Frame==nil and effects==0);preview:Dispose()
local prepared=presets:Create(effect);assert(effects==0);prepared:Dispose()
local effectHandle=presets:Mount(effect);assert(effectHandle.View==nil and effectHandle.Frame==nil and effects==1)
local replacement=presets:Mount(effect);assert(effects==2 and releases==1);effectHandle:Dispose();assert(releases==1)
combat=true;replacement:Dispose();assert(releases==1);combat=false;emit('PLAYER_REGEN_ENABLED');assert(releases==2)
local broken=headless('broken','fragment');broken.root.children={{id='ok',type='effectTest',props={}},{id='bad',type='failingEffect',props={}}}
assert(not pcall(function() presets:Mount(broken) end) and effects==3 and releases==3,'failed activation releases previous effects')
PlayerFrame=CreateFrame('Frame',nil,UIParent)
local hide=headless('hide-native','hideUnitFrame');hide.root.props.unit='player'
local hidePreview=presets:Preview(hide);assert(PlayerFrame:GetParent()==UIParent);hidePreview:Dispose()
local hiddenA=presets:Mount(hide);local hiddenParent=PlayerFrame:GetParent();assert(hiddenParent~=UIParent)
local hide2=headless('hide-native-two','hideUnitFrame');hide2.root.props.unit='player'
local hiddenB=presets:Mount(hide2);hiddenA:Dispose();assert(PlayerFrame:GetParent()==hiddenParent,'last owner controls restoration')
hiddenB:Dispose();assert(PlayerFrame:GetParent()==UIParent)
-- The same dependency may be reused; node IDs, sources, and anchors stay local to each instance.
local child=doc();child.id='shared-child';child.sources[1].type='counted';child.root.children[2].props.relativeTo='a'
local parent={version=1,kind='preset',id='composed',name='Composed',sources={},dependencies={child,effect},root={id='root',type='flow',props={width=440,height=80,direction='horizontal'},children={
 {id='left',type='preset',preset='shared-child',props={}}, {id='right',type='preset',preset='shared-child',props={}}, {id='effect',type='preset',preset='effect',props={}}
}}}
local beforeCreated=created;local combined=presets:Mount(parent)
assert(created==beforeCreated+2 and #combined.View.children==2,'headless references consume no layout slots')
assert(combined.Nodes:get('left/a') and combined.Nodes:get('right/a') and combined.Nodes:get('left'),'qualified node IDs')
assert(combined.View.children[1].children[2].props.relativeTo==combined.View.children[1].children[1],'local anchors')
assert(combined.View.children[1].children[1].source~=combined.View.children[2].children[1].source,'scoped sources')
combined:Dispose()
local one={version=1,kind='preset',id='single',name='Single',sources={},dependencies={effect},root={id='root',type='cell',props={width=40,height=40},children={
 {id='display',type='cell',props={width=20,height=20}}, {id='effect',type='preset',preset='effect',props={}}
}}}
local oneHandle=presets:Mount(one);assert(oneHandle.View.child~=nil);oneHandle:Dispose()
assert(presets:IsHeadless(effect) and not presets:IsHeadless(parent))
local missing=headless('missing','preset');missing.root.preset='unavailable'
assert(not pcall(function() presets:Validate(missing) end),'missing dependency rejected')
local cycle=headless('cycle','preset');cycle.root.preset='cycle'
assert(not pcall(function() presets:Validate(cycle) end),'dependency cycle rejected')
local multi=headless('multi','fragment');multi.root.children={{id='a',type='cell',props={}},{id='b',type='cell',props={}}}
assert(not pcall(function() presets:Validate(multi) end),'fragment cannot silently drop extra visual roots')
-- A single export carries the complete graph and saves each library entry independently.
C_EncodingUtil.DecompressString=function(data) assert(data=='compressed');return 'cbor' end
local bundle=presets:Export(parent);assert(#tokens.payload.dependencies==2)
local imported=presets:Import(bundle);presets:Save(imported)
assert(presets:Get('shared-child') and presets:Get('effect') and presets:Get('composed'))
assert(presets:Get('composed').dependencies==nil and presets:Get('composed').root.children[1].preset=='shared-child','library stores references')
assert(#presets:UsedBy('shared-child')==1 and presets:UsedBy('shared-child')[1].id=='composed','dependency marker')
assert(not pcall(function() presets:Delete('shared-child') end),'used dependencies cannot be deleted')
local altered=presets:Validate(parent);altered.dependencies[1].name='Different version'
assert(not pcall(function() presets:Save(altered) end),'import cannot silently overwrite a conflicting shared preset')
assert(presets:Get('shared-child').name==child.name)
assert(not pcall(function() presets:Mount(altered) end),'conflicting import cannot replace the mounted view before Save')
presets:Save(one)
local turnVisual=headless('effect','cell');turnVisual.root.props={width=20,height=20}
assert(not pcall(function() presets:Save(turnVisual) end) and presets:IsHeadless(presets:Get('effect')),'shared edits cannot violate a consumer child limit')
presets:Delete('single')
local running=presets:Mount(presets:Get('composed'));local oldFrame=running.Frame
local updated=presets:Get('shared-child');updated.root.props.width=200;presets:Save(updated)
assert(not oldFrame.shown,'editing a shared dependency refreshes its mounted parent')
local refreshed=presets.active:get('composed');assert(refreshed.Nodes:get('left').width==200 and refreshed.Nodes:get('right').width==200)
presets:Unmount('composed')
local fromLibrary=presets:Create(presets:Get('composed'));assert(#fromLibrary.View.children==2);fromLibrary:Dispose()
presets:Delete('composed');presets:Delete('shared-child');presets:Delete('effect')
print('Builder runtime checks passed')
