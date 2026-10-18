
local registry=__wuiraModules_LumaUI
C_AddOns={IsAddOnLoaded=function() return true,true end}
local store=new(registry.require('lua_modules.wuira.lib.store.index').StoreRegistry,{addon='LumaUI',variable='BuilderTestDB'})
local presets=new(registry.require('builder.presets.Presets').Presets,store)
local skins=new(registry.require('builder.skins.Skins').Skins,store)
registry.require('builder.builtins.Builtins').registerBuiltins(nil,presets,skins)
local components,sourceTypes={},{}
for _,name in ipairs(presets:ComponentTypes()) do components[name]=true end
for _,name in ipairs(presets:SourceTypes()) do sourceTypes[name]=true end
assert(components.foreach and components.unitText and components.unitAuras and sourceTypes.hp and sourceTypes.power and sourceTypes.groupMembers,'required native and source-driven factories are registered')
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

local chosenAction={version=1,kind='preset',id='chosen-action',name='Chosen action',sources={{name='chosen',type='spell',props={spellId=19750}}},root={id='button',type='secureButton',source='chosen',props={width=24,height=24,action={type='spell',spell=635}}}}
local chosen=presets:Mount(chosenAction)
assert(chosen.Nodes:get('button').attributes.spell1=='Spell 19750','a selected action source overrides the preserved static fallback')
chosen:Dispose();chosenAction.root.source=nil
chosen=presets:Mount(chosenAction)
assert(chosen.Nodes:get('button').attributes.spell1==635,'switching back to static restores the original action')
chosen:Dispose()


-- Existing saved action buttons receive native tooltips without a preset migration.
local oldTooltip,oldInfo=GameTooltip,C_Spell.GetSpellInfo
GameTooltip={shown=false,SetOwner=function(self,owner)self.owner=owner end,IsOwned=function(self,owner)return self.owner==owner end,
 ClearLines=function(self)self.spell=nil;self.item=nil;self.link=nil;self.action=nil;self.text=nil end,
 SetSpellByID=function(self,id)self.spell=id end,SetItemByID=function(self,id)self.item=id end,
 SetHyperlink=function(self,link)self.link=link end,SetAction=function(self,id)self.action=id end,SetUnit=function(self,unit)self.unit=unit end,
 SetText=function(self,text)self.text=text end,Show=function(self)self.shown=true end,Hide=function(self)self.shown=false end}
C_Spell.GetSpellInfo=function(spell)return {spellID=tonumber(tostring(spell):match('%d+'))} end
local function hover(frame,event)for _,hook in ipairs(frame.hooks and frame.hooks[event or 'OnEnter'] or {})do hook(frame)end end
local tipDoc={version=1,kind='preset',id='action-tip',name='Action tooltip',sources={{name='spell',type='spell',props={spellId=19750}}},
 root={id='tip-button',type='secureButton',source='spell',props={width=24,height=24,action={type='spell',spell=635}}}}
local tip=presets:Mount(tipDoc);local button=tip.Nodes:get('tip-button')
hover(button)
assert(GameTooltip.shown and GameTooltip.spell==19750,'bound spell action tooltip wins over its static fallback')
combat=true;hover(button);assert(GameTooltip.spell==19750,'native hover tooltip does not mutate protected actions during combat');combat=false
hover(button,'OnLeave');assert(not GameTooltip.shown)
tip:Dispose()
tipDoc.root.source=nil;tipDoc.root.props.action={type='item',item=3385}
tip=presets:Mount(tipDoc);button=tip.Nodes:get('tip-button');hover(button)
assert(GameTooltip.item==3385,'item actions route to native item tooltips')
tip:Dispose();assert(not GameTooltip.shown,'unmount hides a tooltip owned by that button')
tipDoc.root.props.action={type='item',item='item:3385'}
tip=presets:Mount(tipDoc);hover(tip.Nodes:get('tip-button'));assert(GameTooltip.link=='item:3385');tip:Dispose()
tipDoc.root.props.action={type='action',slot=4}
tip=presets:Mount(tipDoc);hover(tip.Nodes:get('tip-button'));assert(GameTooltip.action==4);tip:Dispose()
tipDoc.root.props.showTooltip=false
tip=presets:Mount(tipDoc);hover(tip.Nodes:get('tip-button'));assert(not GameTooltip.shown,'per-button tooltip opt-out is respected');tip:Dispose()
tipDoc.root.props.showTooltip=nil
local sample=presets:Preview(tipDoc);sample.Frame=registry.require('lua_modules.wuira.lib.index').wuira:Mount(sample.View)
hover(sample.Nodes:get('tip-button'));assert(not GameTooltip.shown,'preview does not expose live action tooltip handlers');sample:Dispose()
local actions=presets:Validate(testBuiltinDocument('PaladinActions'))
assert(actions.id=='action-bars' and actions.dependencies[1].id=='hide-action-bars','action bar is an ordinary importable document with a headless dependency')
actions.enabled='always'
local actionInstance=presets:Mount(actions)
assert(actionInstance.Nodes:get('spell-20271'),'the saved hotbar layout uses the same generic runtime as every component')
actionInstance:Dispose()
GameTooltip=oldTooltip;C_Spell.GetSpellInfo=oldInfo

local playerDocument=testBuiltinDocument('PlayerResources')
playerDocument.root.props.x=11;playerDocument.root.props.y=22
assert(presets:Validate(playerDocument).root.props.x==11,'player starter is a preset document')
local observed=0
local stopObserve=presets:ObserveMount(function(_,document,instance)
 if document.id=='player' then assert(instance.Nodes:get('healthBar') and instance.Nodes:get('manaBar'));observed=observed+1 end
end)
local playerInstance=presets:Mount(playerDocument)
assert(playerInstance.Frame.shown and observed==1,'player collection mounts through the common runtime')
local portraitHost=playerInstance.Nodes:get('playerPortrait')
assert(portraitHost and portraitHost.parent==playerInstance.Nodes:get('healthBar') and portraitHost.width==38 and portraitHost.height==38,'portrait is a saved child beside health/mana')
local portraitButton
for _,frame in ipairs(nativeFrames) do if frame.attributes and frame.attributes.unit=='player' and frame.attributes.type2=='togglemenu' and frame.shown then portraitButton=frame end end
assert(portraitButton and portraitButton.parent==UIParent and not playerInstance.Frame:IsProtected(),'portrait has an independent protected root')
assert(portraitButton.attributes.type1=='target' and portraitButton.clicks[1]=='LeftButtonUp' and portraitButton.clicks[2]=='RightButtonUp','native selection and menu attributes')
assert(portraitButton.texture.portraitUnit=='player','native portrait is drawn')
local updates=portraitButton.texture.portraitUpdates
emit('UNIT_PORTRAIT_UPDATE','party1');assert(portraitButton.texture.portraitUpdates==updates)
combat=true;emit('UNIT_PORTRAIT_UPDATE','player');assert(portraitButton.texture.portraitUpdates==updates+1);combat=false
presets:Unmount('player');stopObserve()
assert(not portraitButton.shown and portraitButton.attributes.type1==nil and next(portraitButton.events)==nil,'portrait disposes with its collection')
local visibleIndicator=false
presets:RegisterSource('portraitFlag',{properties={},Create=function() return {IsActive=function() return visibleIndicator end} end})
local portraitDoc={version=1,kind='preset',id='portrait-test',name='Portrait',sources={{name='flag',type='portraitFlag',props={}}},root={id='root',type='flow',props={width=80,height=40},children={
 {id='portrait',type='unitPortrait',props={width=38,height=38,unit='player'}},
 {id='indicator',type='label',visibleSource='flag',props={width=30,height=2,text='Timer'}}
}}}
local portraitHandle=presets:Mount(portraitDoc)
local indicator=portraitHandle.Nodes:get('indicator')
assert(not indicator.shown)
combat=true;visibleIndicator=true
for _,frame in ipairs(nativeFrames) do if frame.shown and frame.onUpdate then frame.onUpdate(frame,.1) end end
assert(indicator.shown,'resource indicators remain responsive in combat beside the portrait')
combat=false;presets:Unmount('portrait-test')
local beforePreview=#nativeFrames
local preview=presets:Preview(portraitDoc)
preview.Frame=registry.require('lua_modules.wuira.lib.index').wuira:Mount(preview.View)
for i=beforePreview+1,#nativeFrames do assert(not nativeFrames[i].attributes,'preview cannot create a secure portrait button') end
assert(preview.Nodes:get('portrait').texture.portraitUnit=='player','preview draws the real portrait')
preview:Dispose()
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
local reloaded=new(registry.require('builder.presets.Presets').Presets,store)
registry.require('builder.builtins.Builtins').registerBuiltins(nil,reloaded,new(registry.require('builder.skins.Skins').Skins,store))
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
local legacyBars=headless('legacy-bars','hideActionBars')
local normalized=presets:Validate(legacyBars)
assert(normalized.root.type=='hideUnitFrame' and normalized.root.props.unit=='actionBars' and normalized.root.id==legacyBars.root.id and legacyBars.root.type=='hideActionBars','legacy native-bar effects migrate without mutating input or IDs')
for _,kind in ipairs(presets:ComponentTypes())do assert(kind~='hideActionBars','there is one native-frame hiding factory')end
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
-- Imported native visibility belongs to its replacement component.
local function visibilityHarness(variable)
 local memory=new(registry.require('lua_modules.wuira.lib.store.index').StoreRegistry,{addon='LumaUI',variable=variable})
 local p=new(registry.require('builder.presets.Presets').Presets,memory)
 local s=new(registry.require('builder.skins.Skins').Skins,memory)
 registry.require('builder.builtins.Builtins').registerBuiltins(nil,p,s)
 return {Store=memory,Presets=p,Skins=s}
end
local fresh=visibilityHarness('FreshVisibilityDB')
local originalParent=CreateFrame('Frame',nil,UIParent)
PlayerFrame=CreateFrame('Frame',nil,originalParent);TargetFrame=CreateFrame('Frame',nil,UIParent);FocusFrame=CreateFrame('Frame',nil,UIParent)
PlayerFrame.events.HEALTH=true
fresh.Presets:Save(testBuiltinDocument('PlayerResources'),true);fresh.Presets:Restore()
assert(PlayerFrame:GetParent()~=originalParent,'replacement owns the hide effect')
assert(TargetFrame:GetParent()==UIParent and FocusFrame:GetParent()==UIParent,'unreplaced frames remain native')
local freshPlayer=fresh.Presets:Get('player')
fresh.Presets:Unmount('player');fresh.Presets:Save(freshPlayer,false)
assert(PlayerFrame:GetParent()==originalParent and PlayerFrame.events.HEALTH,'disabling replacement restores native parent and keeps native events')
fresh.Presets:Mount(freshPlayer);fresh.Presets:Save(freshPlayer,true)
local freshFrame=fresh.Presets.active:get('player').Frame
combat=true;fresh.Presets:Unmount('player');fresh.Presets:Save(freshPlayer,false)
assert(PlayerFrame:GetParent()~=originalParent and freshFrame.shown,'protected teardown waits for combat')
combat=false;emit('PLAYER_REGEN_ENABLED')
assert(PlayerFrame:GetParent()==originalParent and not freshFrame.shown,'native frame returns with custom frame teardown')
fresh.Presets:Restore();assert(PlayerFrame:GetParent()==originalParent,'disabled replacement stays disabled')
for _,skinDoc in ipairs(fresh.Skins:List()) do fresh.Skins:Remove(skinDoc.id) end
-- A replacement remains editable without startup template rewrites.
local edited=fresh.Presets:Get('player');edited.root.props.width=333
fresh.Presets:Save(edited,false);fresh.Presets:Restore()
assert(fresh.Presets:Get('player').root.props.width==333 and fresh.Presets:ActivationStatus('player')=='Disabled','saved geometry and manual disable survive reconciliation')
assert(PlayerFrame:GetParent()==originalParent,'an inactive imported replacement leaves the native frame visible')
print('Builder runtime checks passed')

-- Fixed-unit built-ins pass the generic document validator.
for _,key in ipairs({'PlayerUnitFrame','TargetUnitFrame'}) do
 local document=presets:Validate(testBuiltinDocument(key))
 assert(document.root.type=='secureButton' and document.root.props.unitWatch)
end
