
      require = nil
      UIParent = {}
      local health,maxHealth,mana,maxMana = 650,1000,120,200
      local healthPercent,manaPercent = 65,60
      local powerReads,nativeManaAlpha=0,1
      CurveConstants = {ScaleTo100={}}
      function UnitHealthPercent(unit,predicted,curve)
        assert(unit == "player" and predicted and curve == CurveConstants.ScaleTo100)
        return healthPercent
      end
      function UnitPowerPercent(unit,powerType,predicted,curve)
        assert(unit == "player" and powerType == 0 and predicted)
        if curve == CurveConstants.ScaleTo100 then return manaPercent end
        assert(curve.points)
        return nativeManaAlpha
      end
      function UnitHealth(unit) assert(unit == "player"); return health end
      function UnitHealthMax(unit) assert(unit == "player"); return maxHealth end
      function UnitPower(unit,powerType) assert(unit == "player" and powerType == 0); powerReads=powerReads+1; return mana end
      function UnitPowerMax(unit,powerType) assert(unit == "player" and powerType == 0); return maxMana end
      function issecretvalue(value) return type(value) == "table" and rawget(value,"secret") == true end
      local frames = {}
      local nativeFrames = {}
      local function emit(event,...)
        for _,frame in ipairs(nativeFrames) do
          if frame.events and frame.events[event] and frame.onEvent then frame.onEvent(frame,event,...) end
        end
      end
      function CreateFrame(kind, name, parent, template)
        assert((kind == "Frame" or kind == "StatusBar" or kind == "Button" or kind == "Cooldown" or kind == "ScrollFrame") and (name == nil or kind == "Button"))
        local frame = { kind = kind, name=name, parent = parent, template = template, textures = {},events={} }
        if name then _G[name]=frame end
        function frame:GetName() return self.name end
        function frame:SetCooldownFromDurationObject(duration,clear) self.cooldownDuration=duration; self.clearIfZero=clear end
        function frame:SetDrawSwipe(value) self.drawSwipe=value end
        function frame:SetDrawEdge(value) self.drawEdge=value end
        function frame:SetDrawBling(value) self.drawBling=value end
        function frame:SetHideCountdownNumbers(value) self.hideNumbers=value end
        function frame:SetSwipeColor(...) self.swipeColor={...} end
        function frame:Clear() self.cooldownDuration=nil end
        function frame:GetCountdownFontString() return self.fontString or self:CreateFontString() end
        function frame:SetAlpha(value) self.alpha=value end
        function frame:SetMinMaxValues(min,max) self.min,self.max=min,max end
        function frame:SetValue(value) self.value=value end
        function frame:SetTimerDuration(duration,interpolation,direction)
          self.timer=duration; self.timerCalls=(self.timerCalls or 0)+1
          assert(interpolation == 0 and direction == 1)
        end
        function frame:SetStatusBarTexture(path) self.fillTexture=path end
        function frame:SetStatusBarColor(r,g,b,a) self.fillColor={r,g,b,a} end
        function frame:SetOrientation(orientation) self.orientation=orientation end
        function frame:SetReverseFill(reverse) self.reverse=reverse end
        function frame:GetStatusBarTexture()
          self.fill = self.fill or {}
          function self.fill:SetHorizTile(value) self.tileX=value end
          function self.fill:SetVertTile(value) self.tileY=value end
          function self.fill:SetBlendMode(value) self.blend=value end
          function self.fill:SetTexCoord(l,r,t,b) self.uv={l,r,t,b} end
          return self.fill
        end
        function frame:SetScale(value) self.scale=value end
        function frame:GetScale() return self.scale or 1 end
        function frame:SetSize(w, h) self.width, self.height = w, h end
        function frame:CreateFontString()
          local text = {}
          self.fontString=text
          function text:SetAllPoints(parent) self.parent=parent end
          function text:SetFont(font,size,flags) self.font,self.size=font,size; return true end
          function text:SetJustifyH(align) self.align=align end
          function text:SetJustifyV() end
          function text:SetTextColor(...) self.color={...} end
          function text:SetText(value) self.text=value end
          return text
        end
        function frame:EnableMouse(enabled) self.mouseEnabled = enabled end
        function frame:GetWidth() return self.width end
        function frame:GetHeight() return self.height end
        function frame:RegisterEvent(event) self.events = self.events or {}; self.events[event] = true end
        function frame:UnregisterAllEvents() self.events = {} end
        function frame:SetScript(script, handler)
          self.scripts=self.scripts or {}; self.scripts[script]=handler
          if script == "OnUpdate" then self.onUpdate = handler elseif script == "OnEvent" then self.onEvent = handler end
        end
        function frame:IsMouseOver() return self.mouseOver == true end
        function frame:SetScrollChild(child) self.scrollChild=child end
        function frame:UpdateScrollChildRect() end
        function frame:GetVerticalScrollRange() return math.max(0,(self.scrollChild and self.scrollChild.height or 0)-(self.height or 0)) end
        function frame:GetVerticalScroll() return self.scrollOffset or 0 end
        function frame:SetVerticalScroll(offset) self.scrollOffset=offset end
        function frame:IsShown() return self.shown == true end
        function frame:SetFrameStrata(value) self.strata=value end
        function frame:SetMovable(value) self.movable=value end
        function frame:SetClampedToScreen(value) self.clamped=value end
        function frame:RegisterForDrag(...) self.dragButtons={...} end
        function frame:StartMoving() self.moving=true end
        function frame:StopMovingOrSizing() self.moving=false end
        function frame:EnableKeyboard(value) self.keyboard=value end
        function frame:SetPropagateKeyboardInput(value) self.propagate=value end
        function frame:GetCenter()
          local x,y=0,0
          if self.relative and self.relative.GetCenter then x,y=self.relative:GetCenter() end
          return x+(self.x or 0),y+(self.y or 0)
        end
        function frame:SetClipsChildren(value) self.clipsChildren=value end
        function frame:GetFrameLevel() return self.frameLevel or 0 end
        function frame:SetFrameLevel(value) self.frameLevel=value end
        function frame:SetPoint(point, relative, relativePoint, x, y)
          assert(type(point) == "string" and type(relativePoint) == "string")
          self.anchor,self.relativeAnchor = point,relativePoint
          self.relative = relative
          self.x, self.y = x, y
        end
        function frame:CreateTexture(name, layer)
          assert(name == nil)
          local texture = { layer = layer, parent = self }
          function texture:SetAllPoints(target) assert(target == self.parent) end
          function texture:SetColorTexture(r, g, b, a) self.color = {r, g, b, a} end
          function texture:SetTexture(path) self.path = path end
          function texture:SetVertexColor(r,g,b,a) self.color = {r,g,b,a} end
          function texture:SetBlendMode(mode) self.blend = mode end
          function texture:SetHorizTile(value) self.tileX=value end
          function texture:SetVertTile(value) self.tileY=value end
          function texture:SetTexCoord(l,r,t,b) self.uv={l,r,t,b} end
          function texture:SetSize(w,h) self.width,self.height = w,h end
          function texture:SetPoint(_,relative,_,x,y) self.x,self.y=x,y end
          function texture:SetParent(parent) self.parent = parent end
          function texture:ClearAllPoints() end
          function texture:Show() self.shown = true end
          function texture:Hide() self.shown = false end
          self.textures[#self.textures+1] = texture
          self.texture = texture
          return texture
        end
        function frame:Show() self.shown = true end
        function frame:Hide() self.shown = false end
        function frame:SetParent(parent) self.parent = parent end
        function frame:GetParent() return self.parent end
        function frame:HookScript(script, handler) assert(script == "OnShow"); self.onShowHook=handler end
        function frame:ClearAllPoints() end
        function frame:SetAllPoints(parent) assert(parent == self.parent) end
        function frame:SetBackdrop(info) self.backdrop = info end
        function frame:SetBackdropBorderColor(r,g,b,a) self.borderColor = {r,g,b,a} end
        frames[#frames + 1] = frame
        nativeFrames[#nativeFrames + 1] = frame
        return frame
      end
      
local combat=false
function InCombatLockdown() return combat end
function UIParent:GetWidth() return 1920 end
function UIParent:GetHeight() return 1080 end
local function new(class,...)
 local instance=setmetatable({},class.prototype); instance:____constructor(...); return instance
end
local originalCreate=CreateFrame
function CreateFrame(kind,name,parent,template)
 local frame=originalCreate(kind=='EditBox' and 'Frame' or kind,name,parent,template)
 if kind=='EditBox' then
  frame.kind='EditBox'
  function frame:SetAutoFocus(v) self.autoFocus=v end
  function frame:SetMultiLine(v) self.multiLine=v end
  function frame:SetFont(path,size,flags) assert(type(path)=='string' and type(size)=='number' and type(flags)=='string','EditBox font flags required');return true end
  function frame:SetTextInsets() end
  function frame:SetMaxBytes(v) self.maxBytes=v end
  function frame:SetText(v) self.text=v end
  function frame:GetText() return self.text end
  function frame:HighlightText() self.highlighted=true end
  function frame:SetFocus() self.focused=true end
  function frame:ClearFocus() self.focused=false end
 end
 function frame:IsProtected() return self.protected or false end
 if template=='SecureActionButtonTemplate' then
  frame.protected=true;frame.attributes={}
  function frame:SetAttribute(k,v) assert(not combat); self.attributes[k]=v end
  function frame:RegisterForClicks(v) self.click=v end
  function frame:SetID(v) self.id=v end
 end
 return frame
end
function SetOverrideBindingClick() assert(not combat) end
function ClearOverrideBindings() assert(not combat) end
Enum={StatusBarInterpolation={Immediate=0},StatusBarTimerDirection={RemainingTime=1},PlayerSwingType={MainHand=0,OffHand=1,Ranged=2}}
C_SwingTimer={}
function GetTime() return 0 end
C_DurationUtil={CreateDuration=function() return {GetRemainingDuration=function() return 0 end,SetTimeFromStart=function() end} end}
C_Spell={GetSpellName=function(id) return 'Spell '..id end,GetSpellTexture=function(id) return id end,GetSpellCooldownDuration=function() return nil end}

function UnitCastingDuration() return nil end
function UnitChannelDuration() return nil end
function UnitCastingInfo() return nil end
function UnitChannelInfo() return nil end

function UIParent:GetCenter() return 0,0 end
