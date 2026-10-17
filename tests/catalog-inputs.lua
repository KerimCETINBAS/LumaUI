local master,editor=__wuiraModules_LumaUI,__wuiraModules_LumaUI_Editor
SettingsPanel=CreateFrame('Frame',nil,UIParent)
Settings={RegisterCanvasLayoutCategory=function() return {GetID=function() return 9 end} end,RegisterAddOnCategory=function() end}
Minimap=CreateFrame('Frame',nil,UIParent);Minimap:SetSize(140,140)
C_AddOns={IsAddOnLoaded=function() return true,true end}
SlashCmdList={};LumaUISettings={};master.require('index')
local ui=editor.require('lua_modules.wuira.lib.index').wuira
local function tick() local count=#nativeFrames;for i=1,count do local f=nativeFrames[i];if f:IsVisible() and f.onUpdate then f.onUpdate(f,.2) end end end
local function findText(text) for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f:IsVisible() and f.fontString and f.fontString.text==text then return f end end end
local function click(text) local f=assert(findText(text),'missing choice '..text);while f and f~=UIParent do if f.kind=='Button' and f.scripts.OnClick then f.scripts.OnClick(f);return end;f=f.parent end;error('not a button '..text) end
local function searchBox()for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f.kind=='EditBox' and f:IsVisible() and f.scripts.OnTextChanged then return f end end end
local values={'legacy'}
local view=editor.require('ArrayInput').ArrayInput(nil,{width=380,values=values,describe=function(_,value)return {value=value,label='Selected '..value} end,
 provider=function(_,selected)return {Search=function(_,query)
 local result={};if query=='' then return result end
 for i=1,60 do local id=tostring(i);local used=false;for _,value in ipairs(selected)do if value==id then used=true end end;if not used then result[#result+1]={value=id,label='Choice '..id} end;if #result==48 then break end end;return result end} end,
 onChange=function(_,next)values=next end})
local frame=ui:Mount(view);local box=assert(searchBox());box:SetFocus();box:SetText('choice');tick()
local count=0;for _,f in ipairs(nativeFrames)do if f:IsVisible() and f.fontString and tostring(f.fontString.text):match('^Choice %d+$')then count=count+1 end end
assert(count==48,'only first 48 results mount')
click('Choice 1');tick();assert(values[1]=='legacy' and values[2]=='1' and not findText('Choice 1'),'selection persists identity and excludes duplicates')
assert(searchBox()==box and box.focused,'selecting retains text input and focus')
local remove
for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f:IsVisible() and f.kind=='Button' and f.width==28 and f.parent.height==32 then remove=f;break end end
assert(remove);remove.scripts.OnClick(remove);tick();assert(#values==1 and values[1]=='legacy' and findText('Choice 1'),'removal refreshes the open result list')
box.scripts.OnEscapePressed(box);assert(not findText('Choice 1') and not box.focused,'Escape closes popup')
box:SetText('choice');tick();assert(findText('Choice 1'));ui:Unmount(frame)
assert(not findText('Choice 1') and box.scripts.OnTextChanged==nil and box.scripts.OnEnterPressed==nil,'unmount releases popup and edit callbacks')

local draft=new(editor.require('Draft').EditorDraft)
draft:Load({version=1,kind='preset',id='spell-inputs',name='Spell inputs',sources={{name='auras',type='aura',props={unit='player',spellIds={12323,2974}}}},root={id='effects',type='unitAuras',props={width=200,height=32,unit='player',category='movement',movementSpellIds={12323,2974}}}})
local form=draft.propertyEditor;form:Ensure();local field=editor.require('SpellField').SpellField(nil,{state=form,name='movementSpellIds',title='Movement effects',rule={type='numbers',editor='spell'},width=380})
local fieldFrame=ui:Mount(field);form:Flush();assert(form.values.movementSpellIds=='12323, 2974','existing array IDs survive opening the field')
ui:Unmount(fieldFrame);form.values.movementSpellIds='[]';form.inputs:clear();assert(form:Save());assert(#draft:Document().root.props.movementSpellIds==0,'explicitly cleared arrays stay empty')
local source=draft.sourceEditor;source:Open('auras');source.values.spellIds='[]';source.inputs:clear();assert(source:Save());assert(#draft:Document().sources[1].props.spellIds==0,'source arrays preserve explicit emptiness')
local valid=LumaUI.Presets:Validate({version=1,kind='preset',id='icon-input',name='Icon input',sources={},root={id='image',type='icon',props={width=24,height=24,texture=135968}}})
assert(valid.root.props.texture==135968,'icon component stores a native texture FileDataID')
local invalid={version=1,kind='preset',id='invalid-icon',name='Invalid',sources={},root={id='image',type='icon',props={texture=1.5}}}
assert(not pcall(function()LumaUI.Presets:Validate(invalid)end),'fractional texture IDs are rejected')
local allowed=editor.require('CharacterActionField').allowedCharacterAction
assert(allowed(nil,{category='spell'}) and allowed(nil,{category='consumable'}) and allowed(nil,{category='item',equipped=true}))
assert(not allowed(nil,{category='item',equipped=false}) and not allowed(nil,{category='macro'}),'secure action picker omits bag gear and macros')
local helper=LumaUI.Helpers.PlayerActions
local disposed,unsubscribed=0,0
LumaUI.Helpers.PlayerActions=function()
 return {Value={{key='spell:635',category='spell',name='Holy Light',action={spellId=635}},{key='item:200',category='consumable',name='Mana potion',action={itemId=200}},{key='item:300',category='item',name='Bag equipment',equipped=false,action={itemId=300}},{key='macro:Heal',category='macro',name='Heal macro',action={macro='Heal'}}},
 onChange=function()return function()unsubscribed=unsubscribed+1 end end,Dispose=function()disposed=disposed+1 end}
end
local state={values={['action.type']='spell',['action.spell']='635'},Flush=function()end,Set=function(self,key,value)self.values[key]=value end}
local actionView=editor.require('CharacterActionField').CharacterActionField(nil,{state=state,width=380})
local actionFrame=ui:Mount(actionView);local actionBox=assert(searchBox());actionBox:SetText('Mana potion');tick();click('Mana potion');tick()
assert(state.values['action.type']=='item' and state.values['action.item']=='200' and state.values['action.spell']=='','selected consumables persist item IDs, never effect spell IDs')
actionBox:SetText('Bag equipment');tick();assert(not findText('Bag equipment'),'bag equipment is not selectable')
actionBox:SetText('Heal macro');tick();assert(not findText('Heal macro'),'macro entry stays outside the character spell/item picker')
ui:Unmount(actionFrame);assert(disposed==1 and unsubscribed==1,'action catalogs and native listeners are owned by the mounted field');LumaUI.Helpers.PlayerActions=helper

draft:Load(valid);form:Ensure()
local iconView=editor.require('IconField').IconField(nil,{state=form,name='texture',title='Icon',width=380})
local iconFrame=ui:Mount(iconView);local iconBox,custom
for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f:IsVisible() and f.kind=='EditBox' then if f.maxBytes==128 then iconBox=f elseif f.maxBytes==4096 then custom=f end end end
assert(iconBox and custom);iconBox:SetText('135920');tick();iconBox.scripts.OnEnterPressed(iconBox);tick();assert(form:Save() and draft:Document().root.props.texture==135920,'icon selection writes a numeric native FileDataID')
ui:Unmount(iconFrame)
form:Ensure();iconFrame=ui:Mount(editor.require('IconField').IconField(nil,{state=form,name='texture',title='Icon',width=380}))
for i=#nativeFrames,1,-1 do local f=nativeFrames[i];if f:IsVisible() and f.kind=='EditBox' and f.maxBytes==4096 then custom=f;break end end
custom:SetText('Interface\\Icons\\INV_Misc_QuestionMark');assert(form:Save() and draft:Document().root.props.texture=='Interface\\Icons\\INV_Misc_QuestionMark','custom texture paths remain supported');ui:Unmount(iconFrame)
print('Catalog inputs: result cap, native focus, array edits, texture IDs and cleanup passed')
