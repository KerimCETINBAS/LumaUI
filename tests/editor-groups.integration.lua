do
local editorRegistry=__wuiraModules_LumaUI_Editor
local draft=new(editorRegistry.require('draft.Draft').EditorDraft)
local starter=LumaUI.Presets:Get('paladin-raid')
draft:Open('paladin-raid')
assert(draft.nodes[1].kind=='foreach' and draft:Children(draft.nodes[1].id)[1].kind=='preset','Repeat opens component reference slots')
assert(#draft.sources==1,'child resource sources do not appear in parent Sources')
draft:Select(draft:Children(draft.nodes[1].id)[1].id);draft:OpenReference()
assert(#draft:Tree()>20 and draft.sources[1],'child definition is editable in its own scope')
local found=false;for _,s in ipairs(draft.sources)do if s.isProp and s.type=='unit' then found=true end end
assert(found,'migrated unit input is visible in child Sources')
draft:New();draft:Add('cell');draft:Add('foreach');local list=draft.selected;local slot=draft:Children(list)[1]
assert(slot.kind=='preset' and #draft.sources==0 and slot.sourceProps.Item=='parent.$item','new Repeat exposes its current item without creating a list source')
local count=#draft.nodes;draft:Add('cell');assert(#draft.nodes==count,'Repeat rejects inline templates')
draft:Select(slot.id);draft:Remove();assert(#draft.nodes==count,'the last template slot is required')
local form=draft.sourceEditor;form:Open();form:Type('groupMembers');form.name='members';form.values.scope='party';assert(form:Save())
draft:Select(list);draft:BindSource('members','source');draft:UpdateSources({draft.sources[1]})
local component={version=1,kind='preset',id='authored-member',name='Authored member',sources={{name='Member',type='unit',props={},isProp=true},{name='HP',type='hp',props={unit='Member'}}},root={id='bar',type='progress',props={width=80,height=12},source='HP'}}
LumaUI.Presets:Save(component)
draft:Select(slot.id);draft:ReplacePreset(component.id);draft:SetReferenceSource('Member','parent.$unit')
assert(draft.Selected.sourceProps.Member=='parent.$unit' and #draft.sources==1,'Data passes current member into named input without parent HP sources')
local before=draft.Selected.sourceProps.Member;draft:SetReferenceSource('Member','missing');assert(draft.Selected.sourceProps.Member==before,'invalid choice rolls back')
local preview=LumaUI.Presets:Preview(draft:Document());preview.Frame=master.require('lua_modules.wuira.lib.index').wuira:Mount(preview.View)
assert(preview.Nodes:get('bar') and preview.Nodes:get('bar').value==75,'child-owned HP renders sample values in preview');preview:Dispose()
local imported=LumaUI.Presets:Import(LumaUI.Presets:Export(draft:Document()));draft:Load(imported)
assert(draft:Document().root.children[1].children[1].sourceProps.Member=='parent.$unit','component input binding survives transfer')
draft.activationMode='never';draft:Apply();draft:Select(slot.id);draft:OpenReference();assert(draft.sources[2].props.unit=='Member' and draft.nodes[1].source=='HP','editing child keeps local binding names')
assert(LumaUI.Presets:Get('paladin-raid').root.children[1].preset==starter.root.children[1].preset,'authoring leaves saved starters unchanged')
draft:New();draft:Add('cell');draft:Add('foreach')
local rowList=draft.selected
form:Open();form:Type('groupMembers');form.name='party';form.values.scope='party';assert(form:Save())
draft:Select(rowList);draft:BindSource('party','source')
local rowSlot=draft:Children(rowList)[1]
local classMember={version=1,kind='preset',id='class-member',name='Class member',sources={{name='MEMBER',type='class',props={},isProp=true},{name='HP',type='hp',props={unit='MEMBER'}},{name='PRIMARY_RESOURCE',type='power',props={unit='MEMBER'}}},root={id='bar',type='progress',props={width=80,height=12},source='HP'}}
LumaUI.Presets:Save(classMember,false)
draft:Select(rowSlot.id);draft:ReplacePreset(classMember.id)
draft:UseRowUnit('$unit')
local savedChild
for _,doc in ipairs(draft:Document().dependencies) do if doc.id=='class-member' then savedChild=doc end end
assert(savedChild,'row unit stores the updated component')
local memberOptional,healthUnit=false,nil
for _,source in ipairs(savedChild.sources) do
 if source.name=='MEMBER' then memberOptional=source.optional==true end
 if source.name=='HP' then healthUnit=source.props.unit end
 if source.name=='PRIMARY_RESOURCE' then assert(source.props.unit=='$unit','power uses the current member') end
end
assert(memberOptional and healthUnit=='$unit','row unit binds health to the repeated member and releases the class input')
local rowPreview=LumaUI.Presets:Preview(draft:Document())
assert(rowPreview.Nodes:get('bar') and rowPreview.Nodes:get('bar').value==75,'a class input no longer blocks the member preview')
rowPreview:Dispose()
originalPrint('Editor roster authoring: isolated child components, Data binding, preview and sharing passed')
end
