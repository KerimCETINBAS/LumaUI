local registry=__wuiraModules_LumaUI
registry.require('lua_modules.wuira.lib.index')
local audit=new(registry.require('SecureNameplateAudit').SecureNameplateAudit)
local plate={}
local forbidden=false
function plate:IsForbidden()return forbidden end
function plate:IsProtected()assert(not forbidden);return false end
function plate:GetAttribute(name)assert(not forbidden and name=='unit');return 'nameplate1' end
function plate:GetUnit()assert(not forbidden);return 'nameplate1' end
local function forbiddenWrite()error('native mutation attempted')end
plate.SetParent,plate.SetPoint,plate.SetAttribute,plate.SetScript,plate.RegisterEvent,plate.Hide,plate.Show=forbiddenWrite,forbiddenWrite,forbiddenWrite,forbiddenWrite,forbiddenWrite,forbiddenWrite,forbiddenWrite
plate.UnitFrame=plate
local guid='A'
UnitGUID=function()return guid end
C_NamePlate={GetNamePlates=function()return {plate}end,GetNamePlateForUnit=function()return plate end}
SecureHandlerSetFrameRef=forbiddenWrite;SecureHandlerWrapScript=forbiddenWrite
RegisterStateDriver=forbiddenWrite
local count=#nativeFrames
audit:Start();assert(#nativeFrames==count+1,'only one plain event observer is created')
local function report()return table.concat(audit:Report(),'\n')end
assert(report():find('UNVERIFIED',1,true) and report():find('identity=public',1,true))
combat=true;emit('NAME_PLATE_CREATED',plate);emit('NAME_PLATE_UNIT_ADDED','nameplate1')
emit('NAME_PLATE_UNIT_REMOVED','nameplate1');guid='B';emit('NAME_PLATE_UNIT_ADDED','nameplate1')
assert(report():find('combat-created=1 combat-added=2 frame-reuse=1 token-reuse=1',1,true))
guid={secret=true};emit('NAME_PLATE_UNIT_ADDED','nameplate1');assert(report():find('identity=secret',1,true))
emit('NAME_PLATE_UNIT_ADDED',{secret=true})
forbidden=true;emit('NAME_PLATE_UNIT_ADDED','nameplate1')
assert(report():find('forbidden-frame',1,true),'previously accessible carriers can become forbidden without being read')
for i=1,200 do emit('NAME_PLATE_UNIT_REMOVED','nameplate1')end
assert(#audit:Report()<=29,'history and report size are bounded')
audit:Stop();local old=report();emit('NAME_PLATE_UNIT_ADDED','nameplate1');assert(report()==old,'stop removes only the observer events')
assert(#nativeFrames==count+1,'no secure action frame or native replacement was created')
combat=false
print('Secure nameplate audit is read-only, bounded and unverified')
