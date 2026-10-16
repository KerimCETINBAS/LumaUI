do
 local store=new(registry.require('lua_modules.wuira.lib.store.index').StoreRegistry,{addon='LumaUI',variable='TransferTestDB'})
 local runtime=new(registry.require('builder.Presets').Presets,store)
 local nativeSkins=new(registry.require('builder.Skins').Skins,store)
 registry.require('builder.Builtins').registerBuiltins(nil,runtime,nativeSkins)
 local service=new(registry.require('builder.PresetTransfer').PresetTransfer,{Presets=runtime,Skins=nativeSkins})
 local function button(id) return {id=id,type='secureButton',props={width=24,height=24,action={type='spell',spell=635}}} end
 local child={version=1,kind='preset',id='transfer-child',name='Child',sources={},root=button('child-button')}
 local document={version=1,kind='preset',id='transfer-parent',name='Parent',sources={},dependencies={child},root={
  id='root',type='flow',props={width=100,height=24},children={button('a'),button('b'),{id='child',type='preset',preset=child.id,props={}}}}}
 runtime:Save(document)
 runtime:SetBinding(document.id,'a','F8');runtime:SetBinding(document.id,'b','F9');runtime:SetBinding(child.id,'child-button','F10')
 local plain=service:Decode(service:Export(document,false),'preset')
 assert(#plain.bindings==0 and plain.document.root.children[1].props.binding==nil,'default export excludes keys')
 local bundle=service:Decode(service:Export(document,true),'preset')
 assert(#bundle.bindings==3 and #bundle.document.dependencies==1,'sharing includes separately addressed nested keys')
 assert(bundle.document.root.children[1].props.binding==nil and bundle.document.dependencies[1].root.props.binding==nil,'bindings never become collection props')
 runtime:SetBinding(document.id,'a','F7');runtime:SetBinding(document.id,'b',nil);runtime:SetBinding(child.id,'child-button',nil)
 local other={version=1,kind='preset',id='transfer-other',name='Other',sources={},root=button('other')}
 runtime:Save(other);runtime:SetBinding(other.id,'other','F8')
 local conflicts=service:Conflicts(bundle)
 assert(#conflicts==1 and conflicts[1].key=='F8' and conflicts[1].message:find('transfer-other',1,true),'conflicts identify the current owner')
 service:ApplyBindings(bundle,'none')
 assert(runtime:GetBinding(document.id,'a')=='F7' and runtime:GetBinding(document.id,'b')==nil,'no import preserves all current keys')
 service:ApplyBindings(bundle,'skip')
 assert(runtime:GetBinding(document.id,'a')=='F7' and runtime:GetBinding(other.id,'other')=='F8' and runtime:GetBinding(document.id,'b')=='F9' and runtime:GetBinding(child.id,'child-button')=='F10','skip imports free keys and preserves conflicting existing assignments')
 service:ApplyBindings(bundle,'replace')
 assert(runtime:GetBinding(document.id,'a')=='F8' and runtime:GetBinding(other.id,'other')==nil,'replace transfers ownership through the binding API')
 local originalGetBindingAction=GetBindingAction
 GetBindingAction=function(key,override) assert(override==false);return key=='Z' and 'JUMP' or '' end
 local nativeConflict={document=bundle.document,bindings={{collection=document.id,node='a',key='Z'}}}
 assert(service:Conflicts(nativeConflict)[1].message:find('game binding JUMP',1,true),'native game bindings are included in warnings')
 service:ApplyBindings(nativeConflict,'skip');assert(runtime:GetBinding(document.id,'a')=='F8','skipping native conflict preserves the current assignment')
 GetBindingAction=originalGetBindingAction
 local malformed={
  {{collection=document.id,node='missing',key='X'}},
  {{collection='outside',node='a',key='X'}},
  {{collection=document.id,node='root',key='X'}},
  {{collection=document.id,node='a',key='X'},{collection=document.id,node='b',key='X'}},
  {{collection=document.id,node='a',key='X'},{collection=document.id,node='a',key='Y'}},
  {{collection=document.id,node='a',key=' '}},
  {{collection=document.id,node='a',key='X',extra=true}},
 }
 local Encoding=registry.require('lua_modules.wuira.lib.platform.Encoding').Encoding
 for _,bindings in ipairs(malformed) do
  local wire='!LUMA:2!'..Encoding:Encode({version=1,document=bundle.document,bindings=bindings})
  assert(not pcall(function() service:Decode(wire,'preset') end),'invalid transfer must be rejected')
  assert(runtime:GetBinding(document.id,'a')=='F8','decoding never changes bindings')
 end
 assert(not pcall(function() runtime:SetBindings(bundle.document,{{collection=document.id,node='a',key='X'},{collection=document.id,node='missing',key='Y'}}) end),'batch validation precedes all assignments')
 assert(runtime:GetBinding(document.id,'a')=='F8','failed batch cannot partially write')
 local legacy={version=1,kind='preset',id='legacy-share',name='Legacy share',sources={},root=button('old')}
 legacy.root.props.binding='K'
 local decoded=service:Decode('!LUMA:1!'..Encoding:Encode(legacy),'preset')
 assert(#decoded.bindings==1 and decoded.bindings[1].key=='K' and decoded.document.root.props.binding==nil,'legacy embedded keys are extracted into optional metadata')
 combat=true
 assert(not pcall(function() service:ApplyBindings(bundle,'replace') end),'binding imports wait until out of combat')
 combat=false
 runtime.Layouts:Dispose();store:Dispose()
 print('Optional keybinding transfer policy checks passed')
end
