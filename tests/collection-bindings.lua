do
 local runtime=LumaUI.Presets
 local stale=runtime:Get('action-bars')
 controls:SetBinding('action-bars','spell-679','CTRL-J')
 runtime:Apply(stale)
 assert(runtime:GetBinding('action-bars','spell-679')=='CTRL-J','applying a stale collection keeps the character binding')
 assert(controls.active:get('action-bars').instance.Nodes:get('spell-679')==bindingTarget('CTRL-J'),'the active secure button owns the character binding')
 local oldProps=runtime:Get('action-bars')
 find(oldProps.root,'spell-679').props.binding='1'
 runtime:Apply(oldProps)
 assert(runtime:GetBinding('action-bars','spell-679')=='CTRL-J' and find(runtime:Get('action-bars').root,'spell-679').props.binding==nil,'legacy props cannot dictate keys')
 local decoded=runtime:Import(runtime:Export(oldProps))
 assert(find(decoded.root,'spell-679').props.binding==nil,'sharing does not include character keys')
 assert(runtime:ComponentProperties('secureButton').binding==nil,'preset inspector has no keybinding prop')
 local buttonId='spell-679'
 local characterStore=LumaUISettings['lumaui.collection-bindings']
 assert(characterStore.collections['action-bars'][buttonId]=='CTRL-J','bindings persist under their own SavedVariables token')
 -- An old saved preset seeds keys exactly once, then explicit unbinding stays empty.
 local StoreRegistry=master.require('lua_modules.wuira.lib.store.index').StoreRegistry
 local store=new(StoreRegistry,{addon='LumaUI',variable='LegacyBindingMigrationDB'})
 local BuilderSettings=master.require('builder.library.Library').BuilderSettings
 store:set(BuilderSettings,function(_,settings)
  settings.documents={{version=1,kind='preset',id='legacy-keys',name='Legacy',sources={},root={
   id='button',type='secureButton',props={width=24,height=24,binding='K',action={type='spell',spell=635}}}}}
  return settings
 end)
 local migrated=new(master.require('builder.presets.Presets').Presets,store)
 master.require('builder.builtins.Builtins').registerBuiltins(nil,migrated,new(master.require('builder.skins.Skins').Skins,store))
 migrated:Restore()
 assert(migrated:GetBinding('legacy-keys','button')=='K' and migrated:Get('legacy-keys').root.props.binding==nil,'existing assignments migrate out of documents')
 migrated:SetBinding('legacy-keys','button',nil)
 local obsolete=migrated:Get('legacy-keys');obsolete.root.props.binding='K'
 migrated:Save(obsolete);migrated:Restore()
 assert(migrated:GetBinding('legacy-keys','button')==nil,'stale legacy data cannot resurrect an unbound key')
 local reloaded=new(master.require('builder.presets.Presets').Presets,new(StoreRegistry,{addon='LumaUI',variable='LegacyBindingMigrationDB'}))
 master.require('builder.builtins.Builtins').registerBuiltins(nil,reloaded,new(master.require('builder.skins.Skins').Skins,store))
 reloaded:Restore();assert(reloaded:GetBinding('legacy-keys','button')==nil,'explicit unbinding survives a new registry and migration')
 migrated.Layouts:Dispose();reloaded.Layouts:Dispose();store:Dispose()
 -- Nested presets use the referenced collection ID, independent of the parent's keys.
 local child={version=1,kind='preset',id='binding-child',name='Bound child',sources={},root={
  id='button',type='secureButton',props={width=24,height=24,action={type='spell',spell=635}}}}
 runtime:Save(child)
 runtime:SetBinding(child.id,'button','SHIFT-J')
 local parent={version=1,kind='preset',id='binding-parent',name='Parent',sources={},root={
  id='child',type='preset',preset=child.id,props={}}}
 runtime:Save(parent,true);runtime:Mount(parent)
 assert(controls.active:get(parent.id).instance.Nodes:get('child/button')==bindingTarget('SHIFT-J'),'nested button resolves keys from its own collection')
 runtime:SetBinding('action-bars','spell-679','SHIFT-J')
 assert(runtime:GetBinding(child.id,'button')==nil and bindingTarget('SHIFT-J')==controls.active:get('action-bars').instance.Nodes:get('spell-679'),'reassignment removes conflicts across collections and refreshes consumers')
 runtime:Delete(parent.id);runtime:Delete(child.id)
 -- A stale visual editor draft cannot restore key props when Apply is pressed.
 local editorDraft=new(__wuiraModules_LumaUI_Editor.require("draft.Draft").EditorDraft)
 editorDraft:Load(runtime:Get('action-bars'))
 controls:SetBinding('action-bars','spell-679','ALT-J')
 editorDraft:Apply()
 assert(runtime:GetBinding('action-bars','spell-679')=='ALT-J' and bindingTarget('ALT-J')==controls.active:get('action-bars').instance.Nodes:get('spell-679'),'editor Apply preserves the latest character binding')
 runtime:Restore()
 assert(runtime:GetBinding('action-bars','spell-679')=='ALT-J','reconciliation preserves separately registered keys')
 controls:SetBinding('action-bars','spell-679',nil)
 runtime:Apply(stale)
 assert(runtime:GetBinding('action-bars','spell-679')==nil and bindingTarget('ALT-J')==nil,'clearing a key releases the native override and stale Apply cannot restore it')
 print('Independent collection keybinding and stale draft checks passed')
end
