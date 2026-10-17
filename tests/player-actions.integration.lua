do
 local names={'C_SpellBook','C_Spell','C_Item','C_Container','GetInventoryItemID','GetNumMacros','GetMacroInfo','MAX_ACCOUNT_MACROS'}
 local old={};for _,name in ipairs(names) do old[name]=_G[name] end
 local learned={635,19750,999};local equipment={[13]=100};local bag={200,200,300};local reads=0
 C_SpellBook={GetNumSpellBookSkillLines=function() return 1 end,GetSpellBookSkillLineInfo=function() return {itemIndexOffset=0,numSpellBookItems=#learned} end,GetSpellBookItemInfo=function(index) return {itemType=1,spellID=learned[index],isPassive=learned[index]==999} end}
 C_Spell={GetSpellName=function(id) return ({[635]='Holy Light',[19750]='Flash of Light',[999]='Passive'})[id] end,GetSpellTexture=function(id) return id end}
 local itemNames={[100]='Equipped trinket',[200]='Mana potion',[300]='Plain gear'}
 local requested={}
 C_Item={GetItemSpell=function(id) reads=reads+1;return id~=300 and 'Use effect' or nil,id~=300 and 123 or nil end,
 GetItemNameByID=function(id) return itemNames[id] end,GetItemIconByID=function(id) return id end,
 GetItemInfoInstant=function(id) return id,'','','',id,id==200 and 0 or 4,0 end,
 RequestLoadItemDataByID=function(id) requested[id]=(requested[id] or 0)+1;emit('ITEM_DATA_LOAD_RESULT',id,true) end}
 function GetInventoryItemID(unit,slot) assert(unit=='player');return equipment[slot] end
 C_Container={GetContainerNumSlots=function(index) return index==0 and #bag or 0 end,GetContainerItemID=function(_,slot) return bag[slot] end}
 MAX_ACCOUNT_MACROS=120
 local macros={[1]='Heal',[2]='Duplicate',[121]='Duplicate'}
 function GetNumMacros() return 2,1 end
 function GetMacroInfo(index) return macros[index],42,'/cast Heal' end
 local list=LumaUI.Helpers:PlayerActions();local values=list.Value
 assert(#values==5,'active learned spells, equipped on-use gear, unique consumables and unambiguous named macros only')
 local byKey={};for _,item in ipairs(values) do byKey[item.key]=item end
 assert(byKey['spell:635'] and not byKey['spell:999'] and byKey['item:100'].category=='item' and byKey['item:200'].category=='consumable' and byKey['macro:Heal'].action.macro=='Heal')
 assert(byKey['item:100'].equipped==true and byKey['item:200'].equipped==false,'equipment identity is exposed independently of item category')
 local moves=0;local stopMove=list:onChange(function() moves=moves+1 end)
 equipment[13]=nil;bag={100,200,300};emit('PLAYER_EQUIPMENT_CHANGED')
 local moved;for _,entry in ipairs(list.Value)do if entry.key=='item:100' then moved=entry end end
 assert(moves==1 and moved and moved.equipped==false,'moving on-use gear into bags emits even when IDs and category are unchanged')
 equipment[13]=100;bag={200,200,300};emit('PLAYER_EQUIPMENT_CHANGED');assert(moves==2);stopMove()
 values[1].name='changed';values[1].action.spellId=1
 local before=reads;local cached=list.Value;assert(reads==before and cached[1].name~='changed','reads are detached and never poll native APIs')
 local updates=0;list:onChange(function() updates=updates+1 end)
 emit('BAG_UPDATE_DELAYED');assert(updates==0 and requested[200]==1,'unchanged events do not emit or request the same item repeatedly')
 equipment[13]=nil;bag={200};macros[1]='New macro';emit('PLAYER_EQUIPMENT_CHANGED');assert(updates==1 and #list.Value==4,'equipment and macro changes refresh the cache')
 equipment[13]=400;emit('PLAYER_EQUIPMENT_CHANGED');assert(updates==1,'uncached items stay absent until their name resolves')
 itemNames[400]='Loaded trinket';emit('ITEM_DATA_LOAD_RESULT',400,true);assert(updates==2 and #list.Value==5,'asynchronous native item completion adds the equipped action')
 learned={635,999};emit('SPELLS_CHANGED');assert(updates==3 and #list.Value==4,'new spellbooks update active choices')
 list:Dispose();before=reads;emit('BAG_UPDATE_DELAYED');emit('SPELLS_CHANGED');assert(reads==before and #list.Value==0,'dispose releases all listeners')
 for _,name in ipairs(names) do _G[name]=old[name] end
 originalPrint('PlayerActions: owned categories, duplicate names, cached reads, events and disposal passed')
end
