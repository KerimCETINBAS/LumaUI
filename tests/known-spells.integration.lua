do
local oldBook,oldSpell=C_SpellBook,C_Spell
local oldBank,oldItemType=Enum.SpellBookSpellBank,Enum.SpellBookItemType
local ids={635,19740,21084,20165,999}
local names={[635]='Holy Light',[19740]='Blessing of Might',[21084]='Seal of Justice',[20165]='Seal of Light',[999]='Seal Mastery'}
local reads=0
Enum.SpellBookSpellBank={Player=0};Enum.SpellBookItemType={Spell=1}
C_SpellBook={GetNumSpellBookSkillLines=function() reads=reads+1;return 1 end,GetSpellBookSkillLineInfo=function() return {itemIndexOffset=0,numSpellBookItems=#ids} end,
 GetSpellBookItemInfo=function(index) return {itemType=1,spellID=ids[index],name=names[ids[index]],isPassive=ids[index]==999} end}
C_Spell={GetSpellName=function(id) return names[id] end,GetSpellTexture=function(id) return id end,GetSpellCooldownDuration=function() return nil end}
local matchers=master.require('helpers.NameSelectors')
local function matches(selector,value,want)
 assert(matchers.compileNameSelector(nil,selector):Test(value)==want,'spell selector mismatch for '..value)
end
matches('Seal*','Seal of Justice',true);matches('Seal?','Seals',true);matches('Seal?','Seal of Justice',false)
matches('Holy Light','HOLY LIGHT',true);matches('Holy Light','Greater Holy Light',false)
matches({regex='SpellN.*',flags='i'},'a SPELLname',true)
matches({regex='^Seal [a-z]+$'},'Seal abc',true);matches({regex='^Seal [a-z]+$'},'Seal 123',false)
matches({regex=[[^Spell\d+$]]},'Spell123',true);matches({regex=[[^Seal\s+of]]},[[Seal\tof]],false)
matches({regex=[[^Seal\s+of]]},'Seal of Justice',true);matches({regex='^A[^0-9]?B$'},'AxB',true)
matches({regex='^A[^0-9]?B$'},'A1B',false);matches({regex='^A[^0-9]?B$'},'AB',true)
matches({regex=[[^Holy\.Light$]]},'Holy.Light',true);matches({regex=[[^Holy\.Light$]]},'Holy Light',false)
local args=matchers.parseSpellSelectors(nil,'"Word, of Light", "Seal*", /^blessing/i')
assert(#args==3 and args[1]=='Word, of Light' and args[3].regex=='^blessing')
for _,invalid in ipairs({'KnownSpells("Seal*",)','KnownSpells(os.execute("bad"))','Other("Seal*")','KnownSpells(/(a|b)/)','KnownSpells(/a/g)','KnownSpells(/[a-/)',[[KnownSpells("bad\n")]]}) do
 assert(not pcall(function() LumaUI.Presets:ParseItems(invalid) end),'unsafe or unsupported helper must reject: '..invalid)
end
local selected=LumaUI.Helpers.KnownSpells(nil,'Holy Light','Seal*',{regex='blessing.*',flags='i'})
assert(#selected.Value==5,'OR selectors deduplicate IDs and retain matching passive metadata in the direct helper')
assert(#consumeKnownSpellCollection(selected)==5,'for...of works from a separately compiled module')
local detached=selected.Value;detached[1].id=1;assert(selected.Value[1].id==635,'collection values are detached')
local before=reads;local values=selected.Value;values=selected.Value
assert(reads==before,'reads and iteration use the cache without native polling')
local changes=0;local stop=selected:onChange(function() changes=changes+1 end)
ids[#ids+1]=1000;names[1000]='Seal of Test';emit('PLAYER_LEVEL_UP')
assert(changes==1 and #selected.Value==6 and #consumeKnownSpellCollection(selected)==6)
stop();selected:Dispose();selected:Dispose();assert(#consumeKnownSpellCollection(selected)==0)
local observedDef=LumaUI.Presets.sources:get('knownSpells');local originalCreate=observedDef.Create
local bindings=0
observedDef.Create=function(self,...)
 local source=originalCreate(self,...);local bind=source.BindItem
 source.BindItem=function(self,...) bindings=bindings+1;return bind(self,...) end
 return source
end
local probes={}
local stopProbe=LumaUI.Presets:RegisterComponent('item-probe',{children='none',properties={},Create=function(_,props,children,context)
 local item=context:Item();assert(type(item.id)=='number' and type(item.name)=='string','ForEach exposes the raw current item to compiled factories')
 probes[item.id]=context
 return master.require('lua_modules.wuira.lib.index').UI.createElement(nil,'cell',{width=0,height=0})
end})
local content={id='content',type='flow',props={width='inherit',height='inherit'},children={
 {id='icon',type='icon',source='item',props={width=24,height=24}},
 {id='name',type='label',textSource='item',props={width=24,height=16,text=''}},
 {id='probe',type='item-probe',props={}}}}
local button={id='button',type='secureButton',source='item',props={width=24,height=40,finishGlow=true},children={content}}
local spellsNode={id='spells',type='foreach',items='KnownSpells("Seal*", /^Blessing of .*/i)',props={width=0,height=0,direction='horizontal',wrapAfter=8,gap=2},children={button}}
local document={version=1,kind='preset',id='known-spells-test',name='Known spell buttons',sources={},root={id='flow',type='flow',props={width=220,height=100},children={spellsNode}}}
local encoded=LumaUI.Presets:Export(document);local roundtrip=LumaUI.Presets:Import(encoded)
assert(roundtrip.root.children[1].items==document.root.children[1].items and #roundtrip.sources==0,'helper expressions and item bindings survive import/export as data')
local mounted=LumaUI.Presets:Mount(document)
local function at(id,node) return mounted.Nodes:get('spells/'..id..'/'..node) end
local original=assert(at(21084,'button'))
assert(bindings==4 and at(999,'button')==nil,'builder excludes passives and binds one source per known active item')
assert(original.attributes.spell1=='Seal of Justice' and at(21084,'icon').texture.path==21084,'current item supplies secure action and icon')
names[21084]='Seal of Justice Updated';emit('PLAYER_LEVEL_UP')
assert(probes[21084]:Item().name==names[21084] and at(21084,'button')==original,'retained item contexts expose current metadata without replacing widgets')
local beforeFrames=#nativeFrames
emit('PLAYER_LEVEL_UP');assert(#nativeFrames==beforeFrames and bindings==4,'unchanged spellbooks preserve native buttons and sources')
combat=true;ids[#ids+1]=1001;names[1001]='Seal of New';emit('PLAYER_LEVEL_UP')
assert(bindings==4 and not at(1001,'button'),'learning in combat queues protected changes')
combat=false;emit('PLAYER_REGEN_ENABLED')
assert(bindings==5 and at(1001,'button') and at(21084,'button')==original,'only a new spell gets a new button: bindings='..bindings..', added='..tostring(at(1001,'button')~=nil)..', retained='..tostring(at(21084,'button')==original))
local remaining={};for _,id in ipairs(ids) do if id~=1000 then remaining[#remaining+1]=id end end;ids=remaining
local removed=at(1000,'button');emit('PLAYER_LEVEL_UP')
assert(not at(1000,'button') and not removed.shown and at(21084,'button')==original,'removing one spell disposes only its tree')
mounted:Dispose();assert(mounted.Nodes.size==0 and not original.shown)
local preview=LumaUI.Presets:Preview(document)
preview.Frame=master.require('lua_modules.wuira.lib.index').wuira:Mount(preview.View)
assert(preview.Nodes:get('spells/21084/button').kind=='Frame' and preview.Nodes:get('spells/21084/icon').texture.path==21084,'spell preview preserves icons without enabling actions')
preview:Dispose()
observedDef.Create=originalCreate;stopProbe()
local draft=new(__wuiraModules_LumaUI_Editor.require('Draft').EditorDraft)
draft:New();draft:Add('foreach');local listId=draft.selected;local template=draft:Children(listId)[1]
draft:BindItems('KnownSpells()')
draft:Select(template.id);draft:Add('action');local spellId=draft.selected;draft:BindSource('item','source')
draft:Add('icon');draft:BindSource('item','source')
draft:Select(listId)
assert(draft:Document().root.children[1].items=='KnownSpells()','spell lists are built with generic Repeat and the list helper')
draft:BindItems('KnownSpells("Seal*")');assert(draft:Document().root.children[1].items=='KnownSpells("Seal*")')
local beforeExpression=draft.Selected.items;draft:BindItems('Unknown("x")')
assert(draft.Selected.items==beforeExpression,'invalid helpers preserve the last valid draft')
draft:Select(spellId);assert(draft:InItemTemplate() and draft.Selected.props.unit==nil)
draft.sourceEditor:Open();draft.sourceEditor:Type('knownSpells');draft.sourceEditor.name='my-spells';draft.sourceEditor.values.selectors='"Seal*"';draft.sourceEditor:Save()
draft:Select(listId);draft:BindSource('my-spells','source')
assert(draft.Selected.items==nil and draft.Selected.source=='my-spells','named list sources replace inline helpers atomically')
C_SpellBook,C_Spell=oldBook,oldSpell;Enum.SpellBookSpellBank,Enum.SpellBookItemType=oldBank,oldItemType
originalPrint('KnownSpells helpers: filters, iteration, keyed buttons, combat, persistence and editor checks passed')
end
