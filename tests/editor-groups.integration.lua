do
local editorRegistry=__wuiraModules_LumaUI_Editor
local draft=new(editorRegistry.require('Draft').EditorDraft)
local choices=editorRegistry.require('ElementCatalog').elementChoices(nil)
local available={};for _,choice in ipairs(choices) do available[choice.value]=true end
assert(available.foreach and available.grid and available.unitText and available.unitIndicator and available.unitAuras and available.action and available.label and available.icon,'authoring exposes all unit/list elements')
local starter=LumaUI.Presets:Get('paladin-raid')
draft:Open('hide-player-frame');assert(#draft:Tree()==1 and not draft:IsVisual(draft.nodes[1]))
draft:Open('paladin-raid')
assert(draft.nodes[1].kind=='foreach' and #draft:Tree()>20 and draft.documentName==starter.name,'component picker restores the full editable raid tree')
for _,entry in ipairs(draft:Tree()) do draft:Select(entry.node.id);draft.propertyEditor:Ensure() end
assert(draft.propertyEditor.nodeId==draft.selected,'all repeated-template props remain selectable')
draft:New()
assert(draft.nodes[1].kind=='fragment' and #draft.sources==0,'New has no special component category')
draft:Add('foreach');local listId=draft.selected;local member=draft:Children(listId)[1].id
assert(draft.sources[1].type=='list' and #draft.sources[1].props.items==0,'Repeat starts with an empty generic list')
local form=draft.sourceEditor
form:Open();form:Type('groupMembers');form.name='members';form.values.scope='party';assert(form:Save())
draft:BindSource('members','source')
draft:UpdateSources({draft.sources[2]})
draft.Selected.props.wrapAfter=5
local document=draft:Document()
assert(document.root.type=='fragment' and document.root.children[1].source=='members' and #document.root.children[1].children==1 and #draft:Tree()==3)
assert(document.sources[1].type=='groupMembers' and document.sources[1].props.scope=='party' and document.class==nil and document.condition==nil,'roster is explicitly bound with a source factory')
draft:Select(member);draft:Remove();assert(#draft:Tree()==3,'last required template cannot be removed')
draft:Add('action');local button=draft.selected
assert(draft.Selected.props.unit=='$unit' and draft.Selected.props.clickCastPreset=='standard')
draft:Add('flow');local layout=draft.selected
assert(draft.Selected.parent==button,'presentation layout can be inserted inside a secure button')
draft:Add('unitText');local name=draft.selected
assert(draft.Selected.parent==layout and draft.Selected.props.unit=='$unit')
draft:Add('progress');local bar=draft.selected
local source=draft.sourceEditor
source:Open();source:Type('hp');source.name='member.health';source.values.unit='$unit';source:Save()
assert(draft.sources[2].name=='member.health' and draft.sources[2].props.unit=='$unit')
draft:BindSource('member.health','source')
assert(draft.Selected.source=='member.health')
draft:Select(layout);draft:Add('unitIndicator');local role=draft.selected
assert(draft.Selected.props.unit=='$unit')
draft:MoveNode(role,name,'before')
assert(draft:Children(layout)[1].id==role,'unit elements can be reordered inside the repeated template')
draft:Select(listId);draft:Add('cell');local petTemplate=draft.selected
local before=#draft.nodes
draft:Select(listId);draft:Add('cell');assert(#draft.nodes==before,'reject a third list template without damaging the draft')
draft:Select(petTemplate);draft:Remove()
assert(draft:DropError(role,listId,'inside')==nil,'hierarchy accepts nesting into ForEach')
local preview=LumaUI.Presets:Preview(draft:Document())
preview.Frame=master.require('lua_modules.wuira.lib.index').wuira:Mount(preview.View)
assert(preview.Nodes:get(member) and preview.Nodes:get(name) and preview.Nodes:get(bar),'blank-authored members render in the preview')
assert(preview.Nodes:get(bar).value==75 and preview.Nodes:get(button).kind=='Frame','preview binds sample health and keeps secure actions disabled')
assert(preview.Frame.height==5*72+4*4,'preview repeats the one member template for five samples')
preview:Dispose();assert(preview.Nodes.size==0)
local imported=LumaUI.Presets:Import(LumaUI.Presets:Export(draft:Document()))
draft:Load(imported);assert(draft:Document().root.children[1].children[1].children[1].children[1].children[3].source=='member.health','authoring tree and bindings survive sharing')
draft:Select(listId);draft.Selected.props.groupBy='group'
form:Open('members');form.values.scope='raid';assert(form:Save())
assert(draft:Document().root.children[1].props.groupBy=='group' and draft:Document().sources[1].props.scope=='raid','raid authoring uses the same factories')
draft:New();draft:Add('foreach')
assert(draft.Selected.kind=='foreach' and draft.Selected.source and #draft:Children(draft.selected)==1,'adding a repeated list creates a valid editable template and source atomically')
assert(LumaUI.Presets:Get('paladin-raid').root.children[1].props.width==starter.root.children[1].props.width,'new drafts do not replace saved starters')
originalPrint('Editor roster authoring: component selection, blank lists, unit sources, nesting and sharing passed')
end
