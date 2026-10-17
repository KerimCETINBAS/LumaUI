local registry=__wuiraModules_LumaUI
local install=registry.require('MinimapLauncher').installMinimapLauncher
math.atan2=math.atan2 or function(y,x)return math.atan(y,x)end
local clicks,saved=0,nil
local function open()clicks=clicks+1 end
-- No library dependency: a named circular native button attaches to the minimap edge.
Minimap=CreateFrame('Frame',nil,UIParent);Minimap:SetSize(140,140);Minimap:SetScale(2);Minimap:Show()
function Minimap:GetCenter()return 100,200 end
GetCursorPosition=function()return 400,400 end
local stop=install(nil,open,function()return 225 end,function(_,position)saved=position end)
local button=assert(LumaUIMinimapButton)
assert(button.parent==Minimap and button.relative==Minimap and button.anchor=='CENTER' and button.relativeAnchor=='CENTER')
assert(button.width==31 and math.abs(math.sqrt(button.x^2+button.y^2)-75)<.001,'button sits on the minimap ring')
local circular=false;for _,texture in ipairs(button.textures)do if texture.path=='Interface\\Minimap\\MiniMap-TrackingBorder'then circular=true end end
assert(circular and button.dragButtons[1]=='LeftButton' and button.onUpdate==nil)
button.scripts.OnClick(button);assert(clicks==1)
button.scripts.OnDragStart(button)
assert(button.onUpdate and math.abs(button.x-75)<.001 and math.abs(button.y)<.001,'cursor coordinates account for minimap scale')
button.scripts.OnDragStop(button)
assert(button.onUpdate==nil and saved==0,'position is saved at drag end without idle polling')
local tooltip={shown=false,SetOwner=function(self,owner)self.owner=owner end,SetText=function(self,text)self.text=text end,
 AddLine=function()end,Show=function(self)self.shown=true end,Hide=function(self)self.shown=false end}
GameTooltip=tooltip
button.scripts.OnEnter(button);assert(tooltip.shown and tooltip.owner==button and tooltip.text=='LumaUI')
button.scripts.OnLeave(button);assert(not tooltip.shown)
stop();stop();assert(not button.shown and button.scripts.OnClick==nil and button.onUpdate==nil)
local x=button.x;Minimap:SetSize(200,200);assert(button.x==x,'disposed hooks are inert')
-- Square minimaps use their perimeter, not a floating screen offset.
GetMinimapShape=function()return 'SQUARE'end
stop=install(nil,open,function()return 225 end)
button=LumaUIMinimapButton
assert(math.abs(button.x+105)<.001 and math.abs(button.y+105)<.001)
stop();GetMinimapShape=nil
-- Late minimap/combat readiness still creates exactly one button.
local map=Minimap;Minimap=nil;local before=#nativeFrames
stop=install(nil,open);assert(#nativeFrames==before+1)
Minimap=map;combat=true;emit('PLAYER_ENTERING_WORLD');assert(#nativeFrames==before+1)
combat=false;emit('PLAYER_REGEN_ENABLED');assert(#nativeFrames==before+2)
emit('ADDON_LOADED','Test');assert(#nativeFrames==before+2)
stop()
-- With LibDBIcon available, register in the normal addon icon ecosystem.
local library={}
function library:GetMinimapButton(name)assert(name=='LumaUI');return self.button end
function library:Register(name,broker,db)
 assert(name=='LumaUI' and broker.type=='launcher' and broker.icon:find('settings.tga',1,true))
 self.broker,self.db=broker,db
 self.button=CreateFrame('Button','LibDBIcon10_LumaUI',Minimap)
 self.button.dataObject,self.button.db=broker,db;self.button:Show()
end
function library:Refresh(name,db)self.db=db;self.button.db=db;self.button:Show()end
function library:Hide(name)self.button:Hide()end
LibStub={GetLibrary=function(_,name,silent)assert(name=='LibDBIcon-1.0'and silent);return library end}
saved=nil;stop=install(nil,open,function()return 120 end,function(_,position)saved=position end)
assert(library.db.minimapPos==120)
library.broker.OnClick(library.button,'LeftButton');assert(clicks==2)
library.db.minimapPos=315
for _,hook in ipairs(library.button.hooks.OnDragStop)do hook(library.button)end
assert(saved==315,'library drag positions are persisted through the owning store callback')
stop();library.broker.OnClick();assert(clicks==2 and not library.button.shown,'disposed broker callbacks cannot reopen the UI')
LibStub=nil;GameTooltip=nil
print('Minimap ring launcher checks passed')
