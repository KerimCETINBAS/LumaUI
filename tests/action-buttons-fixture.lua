-- Ordinary saved components exercise buttons and hiding without an ActionBars addon.
local function testActionButtons()
 local sources,children={},{}
 local rows={{size=28,spells={20271,679,26573}},{size=32,spells={20216}},{size=24,spells={21084}},{size=24,spells={19740}},{size=24,spells={999999}}}
 for index,row in ipairs(rows) do
  local buttons={}
  for _,spell in ipairs(row.spells) do
   local name='spell-'..spell
   sources[#sources+1]={name=name,type='spell',props={spellId=spell}}
   local pending
   if spell==20216 then pending='pending-'..spell;sources[#sources+1]={name=pending,type='aura',props={unit='player',spellId=spell,activeAlpha=.4,inactiveAlpha=1}} end
   buttons[#buttons+1]={id=name,type='secureButton',source=name,alphaSource=pending,props={width=row.size,height=row.size,finishGlow=true,borderColor={r=.22,g=.28,b=.36,a=.8},borderWidth=1},children={
    {id='icon-'..spell,type='icon',source=name,props={width='inherit',height='inherit',margin=1,texCoords={.07,.93,.07,.93}}}
   }}
  end
  children[#children+1]={id='row-'..(index-1),type='flow',props={width=#row.spells*row.size+(#row.spells-1)*4,height=row.size,direction='horizontal',gap=4},children=buttons}
 end
 local hide={version=1,kind='preset',id='hide-action-bars',name='Hide native action bars',sources={},root={id='hide-native-bars',type='hideActionBars',props={}}}
 children[#children+1]={id='hide-native-action-bars',type='preset',preset=hide.id,props={}}
 -- Legacy ownership is deliberately included to exercise import compatibility.
 return {version=1,kind='preset',id='action-bars',name='Action buttons',owner='LumaUI_ActionBars',sources=sources,dependencies={hide},
  root={id='action-bars',type='flow',props={width=92,height=148,direction='vertical',gap=4,mode='absolute',anchor='CENTER',x=0,y=260},children=children}}
end
