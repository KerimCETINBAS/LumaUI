do
 local runtime=LumaUI.Presets
 runtime:SetActivation('action-bars','never')
 assert(MainActionBar:GetParent()==nativeParent)
 local document=runtime:Get('action-bars')
 document.root.props.width=333;document.root.props.x=17
 local function removeHide(node)
  for index=#(node.children or {}),1,-1 do
   local child=node.children[index]
   if child.type=='preset' and child.preset=='hide-action-bars' then table.remove(node.children,index) else removeHide(child) end
  end
 end
 removeHide(document.root)
 runtime:Save(document,false);runtime:Restore()
 assert(runtime:Get('action-bars').root.props.width==333 and runtime:Get('action-bars').root.props.x==17,'disabled imported components retain edited geometry')
 runtime:SetActivation('action-bars','always')
 assert(MainActionBar:GetParent()==nativeParent,'removing the native-hide dependency is not undone automatically')
 runtime:SetActivation('action-bars','never')
 print('Headless action bar visibility and saved-edit checks passed')
end
