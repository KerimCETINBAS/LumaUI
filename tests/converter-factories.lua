local master,editor=__wuiraModules_LumaUI,__wuiraModules_LumaUI_Editor
SettingsPanel=CreateFrame('Frame',nil,UIParent)
Settings={RegisterCanvasLayoutCategory=function() return {GetID=function() return 9 end} end,RegisterAddOnCategory=function() end}
Minimap=CreateFrame('Frame',nil,UIParent);Minimap:SetSize(140,140)
C_AddOns={IsAddOnLoaded=function() return true,true end}
SlashCmdList={};LumaUISettings={}
local payloads={}
C_EncodingUtil={SerializeCBOR=function(value)payloads[#payloads+1]=value;return tostring(#payloads)end,DeserializeCBOR=function(value)return payloads[tonumber(value)]end,
 CompressString=function(v)return v end,DecompressString=function(v)return v end,EncodeBase64=function(v)return v end,DecodeBase64=function(v)return v end}
master.require('index')
local ui=editor.require('lua_modules.wuira.lib.index').wuira
local function tick()local count=#nativeFrames;for i=1,count do local f=nativeFrames[i];if f:IsVisible() and f.onUpdate then f.onUpdate(f,.3) end end end
local attached,detached,disposed=0,0,0
local callbacks={}
local reader={Value=4,IsSecret=function(self)return type(self.Value)=='table' and self.Value.secret==true end,
 onChange=function(self,callback)attached=attached+1;callbacks[callback]=true;return function()callbacks[callback]=nil;detached=detached+1 end end}
local function write(value)reader.Value=value;for callback in pairs(callbacks)do callback(nil,value)end end
LumaUI.Presets:RegisterSource('testValue',{properties={},Create=function()return {value=reader,Dispose=function()disposed=disposed+1 end}end})
local mathDocument={version=1,kind='preset',id='converted-bars',name='Converted bars',sources={{name='input',type='testValue',props={}},{name='double',type='mathConverter',props={source='input',expression='2 * input',min=0,max=100}}},
 root={id='bars',type='flow',props={width=120,height=42},children={{id='first',type='progress',source='double',props={width=120,height=20}},{id='second',type='progress',source='double',props={width=120,height=20}}}}}
local instance=LumaUI.Presets:Mount(mathDocument)
local first,second=instance.Nodes:get('first'),instance.Nodes:get('second')
assert(first.value==8 and second.value==8 and attached==1,'math factory uses one shared upstream subscription')
local frameCount=#nativeFrames;write(6)
assert(first.value==12 and second.value==12 and #nativeFrames==frameCount,'events update both bars without rebuilding widgets')
write({secret=true});assert(first.value==12,'restricted input is not evaluated');write(7);assert(first.value==14)
instance:Dispose();assert(detached==1 and disposed==1 and next(callbacks)==nil,'unmount disposes converter listeners before shared input')
assert(mathDocument.sources[2].props.expression=='2 * input','formulas remain LumaUI document data')

local formula=master.require('builder.MathFormula').MathFormula
for _,entry in ipairs({{'-input ^ 2',-16},{'2 ^ 3 ^ 2',512},{'input % 3',1},{'2 ** -2',.25},{'1e2 + .5',100.5}})do
 assert(new(formula,entry[1]):Evaluate(4)==entry[2],entry[1])
end
for _,expression in ipairs({'input / 0','input % 0','input ^ 10000','input +','math.random()','_G.input','input; print(1)',string.rep('(',40)..'input'..string.rep(')',40)})do
 assert(not pcall(function()return new(formula,expression):Evaluate(4)end),'reject '..expression)
end
local cyclic={version=1,kind='preset',id='cycle',name='Cycle',sources={{name='a',type='mathConverter',props={source='b',expression='input'}},{name='b',type='mathConverter',props={source='a',expression='input'}}},root={id='root',type='cell',props={width=1,height=1}}}
assert(not pcall(function()LumaUI.Presets:Validate(cyclic)end),'unused source cycles are rejected')

local function caseDocument(rows)
 return {version=1,kind='preset',id='cases',name='Cases',sources={{name='input',type='testValue',props={}},{name='converted',type='caseConverter',props={source='input',cases=rows,default='fallback'}}},
 root={id='text',type='label',textSource='converted',props={width=120,height=20,text=''}}}
end
local strict=caseDocument({{equals=1,value='number'},{equals='1',value='text'},{equals=false,value='boolean'}})
local typed=LumaUI.Presets:Create(strict)
write(1);assert(typed.View.props.text()=='number');write('1');assert(typed.View.props.text()=='text');write(false);assert(typed.View.props.text()=='boolean');write(true);assert(typed.View.props.text()=='fallback');typed:Dispose()
assert(not pcall(function()LumaUI.Presets:Validate(caseDocument({{equals='same',value=1},{equals='same',value=2}}))end),'duplicate cases are rejected')

local token,secret='PALADIN',false
function UnitClass()return 'Class',secret and {secret=true} or token,token=='PALADIN' and 2 or 8 end
function UnitIsPlayer()return true end
local colors={version=1,kind='preset',id='class-colors',name='Class colors',sources={{name='klass',type='class',props={unit='player'}},{name='color',type='caseConverter',props={source='klass',path='token',
 cases={{equals='PALADIN',value={r=1,g=.5,b=.7,a=1}},{equals='MAGE',value={r=.2,g=.5,b=1,a=1}}},default={r=.3,g=.3,b=.3,a=1}}}},
 root={id='button',type='secureButton',props={width=120,height=32,unit='player',clickCastPreset='standard',borderWidth=2},bindings={backgroundColor={source='color'},borderColor={source='color'}}}}
local colored=LumaUI.Presets:Mount(colors);local button=colored.Nodes:get('button')
local fill;for _,texture in ipairs(button.textures)do if texture.layer=='BACKGROUND' then fill=texture end end
assert(fill and fill.color[1]==1 and #button.textures==5,'case output colors native background and border')
local widgets,regions=#nativeFrames,#button.textures
combat=true;token='MAGE';emit('UNIT_NAME_UPDATE','player')
assert(fill.color[1]==.2 and #nativeFrames==widgets and #button.textures==regions,'combat styling reuses regions')
assert(button.attributes.type1=='target' and button.attributes.type2=='togglemenu' and button.attributes.unit=='player','style updates leave secure actions intact')
secret=true;emit('UNIT_NAME_UPDATE','player');assert(fill.color[1]==.2)
secret=false;token='PALADIN';emit('UNIT_NAME_UPDATE','player');assert(fill.color[1]==1)
combat=false;colored:Dispose();assert(not fill.shown)

local legacy={version=1,kind='preset',id='legacy-color',name='Legacy color',sources={},root={id='button',type='secureButton',props={width=20,height=20,unit='player',classBackground=true,classBorder=true}}}
local migrated=LumaUI.Presets:Validate(legacy)
assert(legacy.root.props.classBackground==true and migrated.root.props.classBackground==nil and migrated.root.props.classBorder==nil,'migration preserves its input and removes retired flags')
assert(#migrated.sources==2 and migrated.root.bindings.backgroundColor.source==migrated.root.bindings.borderColor.source,'one editable class/color source pair is reused')
assert(LumaUI.Presets:ComponentProperties('secureButton').classBackground==nil,'retired settings are absent from the inspector schema')
local shared=LumaUI.Presets:Import(LumaUI.Presets:Export(migrated));assert(shared.root.bindings.borderColor.source==migrated.root.bindings.borderColor.source,'sharing preserves generic bindings')

local draft=new(editor.require('Draft').EditorDraft);draft:Load(colors)
local state=draft.sourceEditor;state:Open('color')
assert(state.values['cases.count']=='2' and state.values['cases.0.output.type']=='color')
local form=ui:Mount(editor.require('SourceInspector').SourceInspector(nil,{draft=draft,width=420,height=700}))
local edit
for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.kind=='EditBox' and f:IsVisible() and f.text=='PALADIN' then edit=f;break end end
assert(edit,'case matches use native text inputs');edit:SetText('PRIEST');assert(state:Save())
assert(draft:Document().sources[2].props.cases[1].equals=='PRIEST','typed match edits are saved')
ui:Unmount(form);state:AddCase();assert(state.values['cases.count']=='3');state:RemoveCase(2);assert(state.values['cases.count']=='2')
state.values['cases.0.output.r']='.9';assert(state:Save())
draft:Save();local restored=new(editor.require('Draft').EditorDraft)
assert(restored:Document().root.bindings.backgroundColor.source=='color' and restored:Document().sources[2].props.cases[1].value.r==.9,'draft persistence retains editable converters and bindings')
restored:BindProperty('alpha','color','a');restored.propertyEditor:Open();restored.propertyEditor.values['$property.alpha.path']='r';restored.propertyEditor.inputs:clear();assert(restored.propertyEditor:Save() and restored:Document().root.bindings.alpha.path=='r','one Save commits output paths')
restored:BindProperty('alpha','color','value.__proto__');assert(restored.Selected.bindings.alpha.path=='r','invalid paths roll back atomically')

-- The source workspace exposes every form, including converters, in one native scroll area.
state:Open('color')
local sourcesView=ui:Mount(editor.require('SourceInspector').SourceInspector(nil,{draft=draft,width=420,height=360}))
local function shown(text)
 for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.fontString and f.fontString.text==text and f:IsVisible() then return f end end
end
assert(shown('klass') and shown('color') and shown('Case converter') and shown('Input equals'),'source cards expose all source fields without switching a selector')
assert(not shown('color v'),'the source selector is removed')
local scroll
local separators=0
for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f:IsVisible() then
 if f.kind=='ScrollFrame' and f:GetVerticalScrollRange()>0 then scroll=f end
 if f.height==1 and f.width==408 then separators=separators+1 end
end end
assert(separators>=2 and scroll,'source cards are separated and form one scrollable page')
scroll.scripts.OnMouseWheel(scroll,-1);assert(state.scroll>0,'wheel scrolling reveals the remaining source fields')
ui:Unmount(sourcesView)
local classForm=state:For('klass')
classForm.values.unit='focus'
state.values['cases.0.matchType']='number';state.values['cases.0.equals']='invalid'
assert(state.HasChanges and not state:SaveAll())
assert(draft.sources[1].props.unit=='player' and draft.sources[2].props.cases[1].equals=='PRIEST','one invalid source prevents every source form from staging')
state.values['cases.0.matchType']='string';state.values['cases.0.equals']='PRIEST';state.values['cases.0.output.r']='.6'
assert(state:SaveAll())
assert(draft.sources[1].props.unit=='focus' and draft.sources[2].props.cases[1].value.r==.6,'all source forms stage together after validation')
state:BeginNew();classForm=state:For('klass');classForm.values.unit='target';state:Delete()
assert(state:For('klass').values.unit=='target' and state.HasChanges,'canceling a new source retains edits in other cards')
assert(state:SaveAll())

local properties=draft.propertyEditor
properties:Open();properties:Section('Display')
local inspector=ui:Mount(editor.require('PropertyInspector').PropertyInspector(nil,{draft=draft,width=420,height=700}))
assert(shown('Background color') and shown('Source: color v') and not shown('Property sources'),'a visual property owns its source selection')
assert(not shown('Red'),'bound appearance fields hide their static RGBA controls')
ui:Unmount(inspector)
properties:Section('Data')
inspector=ui:Mount(editor.require('PropertyInspector').PropertyInspector(nil,{draft=draft,width=420,height=700}))
assert(not shown('Background color') and not shown('Opacity from source') and not shown('Property sources'),'Data does not duplicate display bindings')
ui:Unmount(inspector)
draft:BindProperty('backgroundColor');properties:Section('Display')
inspector=ui:Mount(editor.require('PropertyInspector').PropertyInspector(nil,{draft=draft,width=420,height=700}))
assert(shown('Red') and shown('Static value v'),'switching a property to Static restores its value editor')
ui:Unmount(inspector)

print('Converter factories: typed cases, arithmetic, events, appearance, migration, editor and persistence passed')
