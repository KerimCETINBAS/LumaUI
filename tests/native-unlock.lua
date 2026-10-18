local master=__wuiraModules_LumaUI
C_AddOns={IsAddOnLoaded=function() return true,true end}
LumaNativeTestSettings={}
local Registry=master.require('lua_modules.wuira.lib.store.index').StoreRegistry
local Layouts=master.require('lua_modules.wuira.lib.datasources.EditModeLayouts').EditModeLayouts
local Controls=master.require('shell.NativeFrameControls').NativeFrameControls
local nativeLayouts={activeLayout=1,layouts={{layoutName='A',layoutType=2},{layoutName='B',layoutType=2}}}
C_EditMode={GetLayouts=function() return nativeLayouts end}
function hooksecurefunc(object,method,callback)
 local original=object[method]
 object[method]=function(self,...) local result=original(self,...);callback();return result end
end
local function frame(name,parent,scale)
 local f=CreateFrame('Button',name,parent or UIParent,'SecureActionButtonTemplate')
 f:SetSize(120,40);f:SetScale(scale or 1);f:SetPoint('CENTER',UIParent,'CENTER',20,30);f:Show()
 function f:GetNumPoints() return self.anchor and 1 or 0 end
 function f:GetPoint() return self.anchor,self.relative,self.relativeAnchor,self.x,self.y end
 function f:ClearAllPoints() self.anchor=nil;self.relative=nil end
 return f
end
PlayerFrame=frame('PlayerFrame',nil,2)
TargetFrame=frame('TargetFrame');TargetFrame:Hide()
local extra=frame('NativeExtra')
local child=frame('NativeChild',PlayerFrame)
EditModeManagerFrame={registeredSystemFrames={PlayerFrame,TargetFrame,extra,child},active=false,
 IsEditModeActive=function(self) return self.active end,
 EnterEditMode=function(self) self.active=true end,ExitEditMode=function(self) self.active=false end}
local registry=new(Registry,{addon='LumaUI',variable='LumaNativeTestSettings'})
local layouts=new(Layouts)
local controls=new(Controls,{Store=registry},layouts)
local function tick()
 local count=#nativeFrames
 for i=1,count do local f=nativeFrames[i];if f:IsVisible() and f.onUpdate then f.onUpdate(f,.1) end end
end
local function handle(label)
 for i=#nativeFrames,1,-1 do local f=nativeFrames[i]
  if f.fontString and f.fontString.text==label and f:IsVisible() then return f end
 end
end
local function start(h)
 h.scripts.OnDragStart(h)
 for _,hook in ipairs(h.hooks.OnDragStart or {}) do hook(h) end
end
local function drag(h,x,y)
 start(h);h:SetPoint('CENTER',UIParent,'CENTER',x,y);h.onUpdate(h,.1);h.scripts.OnDragStop(h)
end
assert(not handle('Native · Player') and PlayerFrame.x==20,'locked mode leaves untouched native frames intact')
controls:SetMode('unlock')
local mover=assert(handle('Native · Player'))
assert(mover.width==240 and mover.height==80 and mover.x==40 and mover.y==60,'native scale is converted to UIParent coordinates')
assert(handle('Native · NativeExtra') and not handle('Native · Target') and not handle('Native · NativeChild'),'registered native systems are discovered; hidden and nested targets have no handles')
drag(mover,180,-90)
assert(PlayerFrame.x==90 and PlayerFrame.y==-45,'drag moves the real native frame with scale correction')
local saved=LumaNativeTestSettings['lumaui.native-frame-positions']
assert(saved.layouts['2::A'].PlayerFrame.x==180 and saved.layouts['2::A'].PlayerFrame.y==90,'position is saved under the active native layout token')
tick()
PlayerFrame:SetPoint('TOPLEFT',UIParent,'TOPLEFT',15,25);tick()
assert(PlayerFrame.anchor=='CENTER' and PlayerFrame.x==90 and PlayerFrame.y==-45,'native reanchoring restores an owned override outside combat')
TargetFrame:Show();tick()
assert(handle('Native · Target'),'late visibility creates a handle while unlocked')
TargetFrame:Hide();tick()
assert(not handle('Native · Target'),'hiding a native frame removes its overlay')
nativeLayouts.activeLayout=2;emit('EDIT_MODE_LAYOUTS_UPDATED',nativeLayouts);tick()
assert(PlayerFrame.anchor=='TOPLEFT' and PlayerFrame.x==15 and PlayerFrame.y==25,'switching to an unedited layout restores the latest native anchor')
drag(assert(handle('Native · Player')),300,-120);tick()
assert(LumaNativeTestSettings['lumaui.native-frame-positions'].layouts['2::B'].PlayerFrame.x==300 and LumaNativeTestSettings['lumaui.native-frame-positions'].layouts['2::A'].PlayerFrame.x==180,'saving B does not replace A')
nativeLayouts.activeLayout=1;emit('EDIT_MODE_LAYOUTS_UPDATED',nativeLayouts);tick()
assert(PlayerFrame.x==90 and PlayerFrame.y==-45,'layout-specific positions remain independent')
EditModeManagerFrame:EnterEditMode();tick()
assert(not handle('Native · Player') and PlayerFrame.x==15,'native Edit Mode temporarily owns its frames')
PlayerFrame:SetPoint('TOPLEFT',UIParent,'TOPLEFT',45,55)
EditModeManagerFrame:ExitEditMode();tick()
assert(PlayerFrame.x==90 and PlayerFrame.y==-45,'leaving native Edit Mode reapplies the Luma layout override')
combat=true;controls:SetMode('locked')
PlayerFrame:SetPoint('CENTER',UIParent,'CENTER',7,8)
tick()
assert(PlayerFrame.x==7 and not handle('Native · Player'),'combat removes overlays without touching protected native anchors')
combat=false;emit('PLAYER_REGEN_ENABLED');tick()
assert(PlayerFrame.x==90 and PlayerFrame.y==-45,'pending override resumes after combat')
controls:Dispose();registry:Dispose();layouts:Dispose()
PlayerFrame:SetPoint('TOPLEFT',UIParent,'TOPLEFT',60,70)
registry=new(Registry,{addon='LumaUI',variable='LumaNativeTestSettings'});layouts=new(Layouts)
controls=new(Controls,{Store=registry},layouts)
assert(PlayerFrame.x==90 and PlayerFrame.y==-45,'a new registry and controller restore saved positions after reload')
controls:SetMode('unlock');controls:Reset()
assert(not handle('Native · Player') and PlayerFrame.anchor=='TOPLEFT' and PlayerFrame.x==60 and PlayerFrame.y==70,'reset restores native anchors and removes the handles')
assert(next(LumaNativeTestSettings['lumaui.native-frame-positions'].layouts)==nil,'reset clears saved native overrides')
controls:Dispose();registry:Dispose();layouts:Dispose()
print('Native unlock: discovery, scale, persistence, layouts, visibility, native Edit Mode, reset and combat passed')
