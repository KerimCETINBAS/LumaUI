-- Compiled Luma factories + Wuira runtime, with mock native nameplates (not in-game validation).
(function()
    local oldGUID, oldName, oldClass, oldPlayer, oldFriend, oldAttack = UnitGUID, UnitName, UnitClass, UnitIsPlayer, UnitIsFriend, UnitCanAttack
    local oldAPI, oldHook, oldReporter, oldHealth, oldMax = C_NamePlate, hooksecurefunc, geterrorhandler, UnitHealth, UnitHealthMax
    local plates, units, errors, reads = {}, {}, {}, {}
    local function native(parent)
        local f=CreateFrame('Frame',nil,parent);f:SetSize(100,20);f.alpha=1
        function f:GetAlpha()return self.alpha end
        function f:IsForbidden()return self.forbidden or false end
        function f:IsProtected()return self.protected or false end
        function f:GetStatusBarColor()return (table.unpack or unpack)(self.fillColor or {1,1,1,1})end
        return f
    end
    local a,b=native(UIParent),native(UIParent)
    a.UnitFrame,b.UnitFrame=native(a),native(b)
    a.UnitFrame.healthBar,b.UnitFrame.healthBar=native(a.UnitFrame),native(b.UnitFrame)
    a.UnitFrame:RegisterEvent('KEEP_NATIVE');local nativeHandler=function()end;a.UnitFrame:SetScript('OnEvent',nativeHandler)
    C_NamePlate={GetNamePlates=function()local t={}for _,p in pairs(plates)do t[#t+1]=p end return t end,
        GetNamePlateForUnit=function(unit)return plates[unit]end}
    UnitGUID=function(unit)return units[unit] and units[unit].guid end
    UnitName=function(unit)return units[unit] and units[unit].name end
    UnitClass=function(unit)return 'Class',units[unit] and units[unit].class,1 end
    UnitIsPlayer=function(unit)return units[unit] and units[unit].player end
    UnitIsFriend=function(_,unit)return units[unit] and units[unit].friendly end
    UnitCanAttack=function(_,unit)return units[unit] and units[unit].attackable end
    UnitHealth=function(unit)reads[unit]=(reads[unit]or 0)+1;return 42 end
    UnitHealthMax=function()return 100 end
    geterrorhandler=function()return function(err)errors[#errors+1]=err end end
    hooksecurefunc=function(frame,method,callback)local old=frame[method];frame[method]=function(self,...)old(self,...);callback(self,...)end end
    local function add(token,frame,guid)
        units[token]={guid=guid,name='Example',class='MAGE',player=false,friendly=false,attackable=true}
        plates[token],frame.namePlateUnitToken=frame,token;emit('NAME_PLATE_UNIT_ADDED',token)
    end
    local function remove(token)plates[token],units[token]=nil,nil;emit('NAME_PLATE_UNIT_REMOVED',token)end
    local convert=registry.require('helpers.UnitToBool').UnitToBool
    local count,disposed=0,0
    presets:RegisterSource('plateHealth',{properties={},Create=function(_,_,context)
        count=count+1;return {progress=new(HP,context:Unit('$unit')),Dispose=function()disposed=disposed+1 end}
    end})
    local document={version=1,kind='preset',id='nameplate-test',name='Nameplates',sources={
        {name='filter',type='unitToBool',props={npcIds={123,456},attackable=true}},
        {name='health',type='plateHealth',props={}},
    },root={id='native',type='blizzardElement',props={type='dynamic',target='nameplate',filter='filter',replace=true},children={
        {id='bar',type='progress',source='health',props={width=140,height=12}}
    }}}
    local created=presets:Create(document);assert(created.View==nil and count==0,'templates are lazy');created:Dispose()
    local live=presets:Mount(document);assert(count==0,'no source is created before a matching plate appears')
    add('nameplate1',a,'Creature-0-0-0-0-123-1')
    assert(count==1 and a.UnitFrame.alpha==0,'matching plate is replaced')
    local first=assert(live.Nodes:get('native/nameplate1/bar'));assert(first.value==42 and first.parent==a)
    add('nameplate2',b,'Creature-0-0-0-0-456-2')
    local second=assert(live.Nodes:get('native/nameplate2/bar'));assert(first~=second and count==2)
    assert(#errors==0,tostring(errors[1]))
    add('nameplate1',a,'Creature-0-0-0-0-123-3')
    assert(count==3 and disposed==1 and not first.shown,'GUID recycling disposes per-unit sources')
    assert(convert(nil,{npcIds={123},classes='MAGE, WARRIOR',player=false,attackable=true})(nil,'nameplate1'))
    assert(not convert(nil,{player=true})(nil,'nameplate1'))
    units.nameplate1.guid={secret=true};assert(not convert(nil,{})(nil,'nameplate1'));units.nameplate1.guid='Creature-0-0-0-0-123-3'
    units.nameplate1.friendly={secret=true};assert(not convert(nil,{friendly=false})(nil,'nameplate1'));units.nameplate1.friendly=false
    assert(not convert(nil,{npcIds={999}})(nil,'nameplate1'))
    assert(not pcall(convert,nil,{npcIds={1.5}}),'invalid NPC ID')
    local before=reads.nameplate2
    combat=true;remove('nameplate2');combat=false
    emit('UNIT_HEALTH','nameplate2');assert(reads.nameplate2==before and disposed==2,'removed plate stops HP subscriptions in combat')
    live:Dispose();assert(disposed==count and a.UnitFrame.alpha==1 and a.UnitFrame.events.KEEP_NATIVE and a.UnitFrame.onEvent==nativeHandler)
    -- Serialized Apply uses the same skin registration path and restores its properties.
    document.root.props={type='dynamic',target='nameplate',filter='filter',apply=true,width=180,height=9,healthColor={r=.1,g=.2,b=.3}}
    document.root.children=nil
    live=presets:Mount(document)
    assert(a.UnitFrame.alpha==1 and a.UnitFrame.healthBar.width==180 and a.UnitFrame.healthBar.fillColor[2]==.2)
    live:Dispose();assert(a.UnitFrame.healthBar.width==100 and a.UnitFrame.healthBar.fillColor[2]==1)
    local function invalid(edit)
        local copy=presets:Validate(document);edit(copy);assert(not pcall(presets.Validate,presets,copy),'invalid native element accepted')
    end
    invalid(function(d)d.root.props.replace=true end)
    invalid(function(d)d.root.props.filter='missing' end)
    invalid(function(d)d.root.props.apply=nil;d.root.props.replace=true;d.root.props.width=nil;d.root.props.height=nil;d.root.props.healthColor=nil
        d.root.children={{id='secure',type='secureButton',props={action={type='target',unit='$unit'}}}}end)
    -- Preview builds a sample template, never a native rule.
    document.root.props={type='dynamic',target='nameplate',filter='filter',replace=true}
    document.root.children={{id='bar',type='progress',source='health',props={width=140,height=12}}}
    local sample=presets:Preview(document);assert(sample.View and a.UnitFrame.alpha==1);sample:Dispose();assert(disposed==count)
    -- A failed template source is rolled back before native visuals are suppressed.
    presets:RegisterSource('brokenPlate',{properties={},Create=function()error('broken template')end})
    document.sources[2].type='brokenPlate'
    local failures=#errors;live=presets:Mount(document)
    assert(#errors==failures+1 and a.UnitFrame.alpha==1);live:Dispose()
    -- Earlier sibling sources are released if a later source constructor throws.
    document.sources[2].type='plateHealth'
    document.sources[3]={name='broken',type='brokenPlate',props={}}
    document.root.children={{id='layout',type='flow',props={width=140,height=24},children={
        {id='good',type='progress',source='health',props={width=140,height=12}},
        {id='bad',type='progress',source='broken',props={width=140,height=12}},
    }}}
    local previousCount=count
    live=presets:Mount(document)
    assert(count==previousCount+1 and disposed==count and a.UnitFrame.alpha==1,'partial source construction rolls back');live:Dispose()
    -- Failing mount callbacks cannot retain stale native node references.
    presets:RegisterComponent('badMount',{children='none',properties={},Create=function()
        return registry.require('lua_modules.wuira.lib.ui.primitives.jsx').UI.createElement(nil,'cell',{onMount=function()error('bad onMount')end})
    end})
    document.root.children={{id='failed',type='badMount',props={}}}
    live=presets:Mount(document)
    assert(not live.Nodes:has('native/nameplate1/failed') and a.UnitFrame.alpha==1,'failed mount clears unit node scope');live:Dispose()
    -- JSX component uses a factory (not a shared prebuilt child); collection cleanup owns the group.
    local factory=registry.require('lua_modules.wuira.lib.ui.primitives.jsx').UI.createElement
    local API=registry.require('lua_modules.wuira.lib.index').wuira
    local plateFactory=function(p)return factory(nil,'progress',{width=75,height=8,source=new(HP,p.Unit)})end
    local host=factory(nil,skins.BlizzardElement,{type='dynamic',target='nameplate',replace=true,filter=convert(nil,{})},plateFactory)
    local root=API:Mount(host);assert(a.UnitFrame.alpha==0)
    API:Unmount(root);assert(a.UnitFrame.alpha==1)
    UnitGUID,UnitName,UnitClass,UnitIsPlayer,UnitIsFriend,UnitCanAttack=oldGUID,oldName,oldClass,oldPlayer,oldFriend,oldAttack
    C_NamePlate,hooksecurefunc,geterrorhandler,UnitHealth,UnitHealthMax=oldAPI,oldHook,oldReporter,oldHealth,oldMax
    print('Luma nameplate factories and unit conversion checks passed')
end)()
