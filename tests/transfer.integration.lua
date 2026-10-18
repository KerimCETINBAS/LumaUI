do
 local Transfer=master.require('builder.transfer.PresetTransfer').PresetTransfer
 local service=new(Transfer,LumaUI)
 local Encoding=master.require('lua_modules.wuira.lib.platform.Encoding').Encoding
 local captured
 local function document(id)
  return {version=1,kind='preset',id=id,name=id,sources={},root={id='root',type='flow',props={width=80,height=24},children={
   {id='a',type='secureButton',props={width=24,height=24,action={type='spell',spell=635}}},
   {id='b',type='secureButton',props={width=24,height=24,action={type='spell',spell=635}}}
  }}}
 end
 local function wire(id)
  return '!LUMA:2!'..Encoding:Encode({version=1,document=document(id),bindings={
   {collection=id,node='a',key='ALT-X'},{collection=id,node='b',key='ALT-Y'}
  }})
 end
 local function open(id,include)
  captured=nil
  LumaUI:OpenImport('preset',function(_,value) captured=value end)
  local input=latestInput();input:SetText(wire(id))
  if include then click('Import keybindings: No') end
  assert(latestInput().text:sub(1,8)=='!LUMA:2!','toggling import keys preserves pasted text')
  click('Import')
 end
 controls:SetBinding('action-bars','spell-679','ALT-X')
 open('transfer-default',false)
 assert(captured and LumaUI.Presets:GetBinding('transfer-default','a')==nil,'default import leaves keys untouched')
 for _,policy in ipairs({'Import without keys','Skip conflicts','Replace bindings'}) do
  controls:SetBinding('action-bars','spell-679','ALT-X')
  local id=policy=='Import without keys' and 'transfer-none' or policy=='Skip conflicts' and 'transfer-skip' or 'transfer-replace'
  open(id,true)
  assert(not captured and LumaUI.Presets:GetBinding(id,'a')==nil and LumaUI.Presets:GetBinding('action-bars','spell-679')=='ALT-X','conflict dialog writes nothing before a decision')
  click(policy)
  assert(captured and captured.root.children[1].props.binding==nil,'confirmed import passes only collection data to the editor')
  if policy=='Replace bindings' then
   assert(LumaUI.Presets:GetBinding(id,'a')=='ALT-X' and LumaUI.Presets:GetBinding('action-bars','spell-679')==nil)
  elseif policy=='Skip conflicts' then
   assert(LumaUI.Presets:GetBinding(id,'a')==nil and LumaUI.Presets:GetBinding(id,'b')=='ALT-Y' and LumaUI.Presets:GetBinding('action-bars','spell-679')=='ALT-X')
  else assert(LumaUI.Presets:GetBinding(id,'a')==nil and LumaUI.Presets:GetBinding(id,'b')==nil) end
  if LumaUI.Presets:GetBinding(id,'a') then LumaUI.Presets:SetBindings(document(id),{{collection=id,node='a',key='CTRL-ALT-X'}}) end
  if LumaUI.Presets:GetBinding(id,'b') then LumaUI.Presets:SetBindings(document(id),{{collection=id,node='b',key='CTRL-ALT-Y'}}) end
 end
 controls:SetBinding('action-bars','spell-679','ALT-X')
 open('transfer-cancel',true);click('Cancel')
 assert(not captured and LumaUI.Presets:GetBinding('transfer-cancel','a')==nil,'Cancel does not import keys or the collection')
 open('transfer-stale',true)
 controls:SetBinding('action-bars','spell-20271','ALT-Y')
 click('Replace bindings')
 assert(not captured and LumaUI.Presets:GetBinding('transfer-stale','a')==nil,'changed conflicts must be reviewed again')
 combat=true;click('Replace bindings');assert(not captured,'combat blocks pending replacement')
 combat=false;click('Import without keys');assert(captured)
 controls:SetBinding('action-bars','spell-679','CTRL-X')
 LumaUI:OpenExport(LumaUI.Presets:Get('action-bars'))
 assert(service:Decode(latestInput().text,'preset').bindings[1]==nil,'export defaults to no keys')
 click('Export keybindings: No')
 assert(latestInput().focused and latestInput().highlighted and #service:Decode(latestInput().text,'preset').bindings>0,'export inclusion regenerates and selects the share string')
 click('Export keybindings: Yes')
 assert(#service:Decode(latestInput().text,'preset').bindings==0,'export exclusion removes the separate metadata')
 click('Close')
 print('Transfer dialog optional bindings and conflict choice checks passed')
end
