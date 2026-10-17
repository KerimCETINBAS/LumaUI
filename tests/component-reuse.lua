-- Actual emitted builder: shared source identity, ownership and per-reference activation.
do
 local made,disposed=0,0
 local shared
 local unregister=presets:RegisterSource('sharedTest',{properties={},Create=function()
  made=made+1;shared={progress=new(HP,'player'),Dispose=function()disposed=disposed+1 end};return shared
 end})
 local aliasCalls=0
 local stopProbe=presets:RegisterComponent('probe',{properties={width={type='number'},height={type='number'}},children='none',source='progress',Create=function(_,props,children,ctx)
  assert(ctx:Source()==shared,'child receives the original SourceInstance, not a wrapper or new observer')
  aliasCalls=aliasCalls+1;return {kind='cell',props={width=10,height=10}}
 end})
 local child={version=1,kind='preset',id='shared-child',name='Shared child',enabled='never',sources={{name='input',type='sharedTest',props={},isProp=true}},root={id='probe',type='probe',props={},source='input'}}
 local parent={version=1,kind='preset',id='shared-parent',name='Shared parent',sources={{name='health',type='sharedTest',props={}}},dependencies={child},root={id='root',type='flow',props={width=100,height=40},children={
  {id='a',type='preset',preset=child.id,props={},activation={enabled='always'},sourceProps={input='health'}},
  {id='b',type='preset',preset=child.id,props={},activation={enabled='always'},sourceProps={input='health'}},
  {id='c',type='preset',preset=child.id,props={},activation={enabled='never'},sourceProps={input='health'}}
 }}}
 local instance=presets:Mount(parent)
 assert(made==1 and aliasCalls==2,'one parent source supplies both active references')
 assert(instance.Nodes:get('a/probe') and instance.Nodes:get('b/probe') and not instance.Nodes:get('c/probe'))
 assert(presets:Validate(parent).dependencies[1].enabled=='never','instance override does not alter definition')
 instance:Dispose();assert(disposed==1,'borrowed inputs never dispose the parent source twice')
 parent.root.children[1].activation.enabled='never';parent.root.children[2].activation.enabled='never'
 instance=presets:Mount(parent);assert(made==1,'inactive children do not instantiate their parent input');instance:Dispose()
 parent.root.children[1].activation.enabled='always';parent.root.children[1].sourceProps={}
 instance=presets:Mount(parent);assert(not instance.Nodes:get('a/probe'),'missing required input leaves reference inactive');instance:Dispose()
 parent.dependencies[1].sources[1].optional=true
 instance=presets:Mount(parent);assert(made==1,'optional unbound input never constructs a source');instance:Dispose()
 local bad=presets:Validate(parent);bad.root.children[1].sourceProps={unknown='health'}
 assert(not pcall(function()presets:Validate(bad)end),'unknown exposed input rejected')
 bad=presets:Validate(parent);bad.sources[1].type='hp';bad.root.children[1].sourceProps={input='health'}
 assert(not pcall(function()presets:Validate(bad)end),'incompatible source type rejected')
 local forwarded=presets:Validate(parent)
 forwarded.sources={{name='health',type='sharedTest',props={},isProp=true}}
 forwarded.root.children[1].sourceProps={input='health'}
 forwarded.root.children[1].activation.enabled='always'
 local outer={version=1,kind='preset',id='outer',name='Outer',sources={{name='owner',type='sharedTest',props={}}},dependencies={forwarded},root={id='forwarded',type='preset',preset=forwarded.id,props={},sourceProps={health='owner'}}}
 instance=presets:Mount(outer);assert(made==2 and aliasCalls==3,'source inputs can be forwarded through another component')
 instance:Dispose();assert(disposed==2,'forwarded aliases keep single-owner cleanup')
 stopProbe();unregister()
end
do
 local function doc(id,name,root)return {version=1,kind='preset',id=id,name=name,sources={},root=root or {id='box',type='cell',props={width=10,height=10}}}end
 local first=doc('old-identity','Original identity');presets:Save(first)
 local consumer=doc('consumer','Consumer',{id='link',type='preset',preset=first.id,props={}});presets:Save(consumer)
 local identity=presets:Identity('New purpose',first.id);assert(identity.id=='new-purpose' and not identity.duplicate)
 first.id=identity.id;first.name=identity.name;presets:Rename(first,'old-identity',true)
 assert(not presets:Get('old-identity') and presets:Get('consumer').root.preset=='new-purpose','yes updates references and removes old identity')
 local duplicate=presets:Identity('New purpose');assert(duplicate.name=='New purpose (1)' and duplicate.id=='new-purpose-1')
 local nextID=presets:Identity('Other purpose',first.id);first.id=nextID.id;first.name=nextID.name
 presets:Rename(first,'new-purpose',false)
 assert(not presets:Get('new-purpose') and presets:Get('consumer').root.preset=='new-purpose','no preserves missing references with no alias')
 local broken=presets:Get('consumer');assert(not pcall(function()presets:Validate(broken)end),'runtime still rejects missing references')
 assert(presets:Validate(broken,true).root.preset=='new-purpose','editor can open a missing reference for manual repair')
 broken.root.preset=first.id;presets:Save(broken);assert(presets:Validate(presets:Get('consumer')))
 combat=true;assert(not pcall(function()presets:Rename(first,first.id,true)end),'combat rename rejected');combat=false
end
print('Component reuse, shared source inputs and optional identity reference updates passed')

do
 local leaf={version=1,kind='preset',id='signature-leaf',name='Leaf',sources={},condition='inParty',root={id='box',type='cell',props={}}}
 local middle={version=1,kind='preset',id='signature-middle',name='Middle',sources={},root={id='leaf',type='preset',preset=leaf.id,props={}}}
 local parent={version=1,kind='preset',id='signature-root',name='Root',sources={},root={id='root',type='flow',props={},children={
  {id='inactive',type='preset',preset=middle.id,props={},activation={enabled='never'}},
  {id='active',type='preset',preset=middle.id,props={},activation={enabled='always'}}}}}
 local docs={[leaf.id]=leaf,[middle.id]=middle};local map={get=function(_,key)return docs[key]end}
 local matches=false;local context={Matches=function(_,doc)return doc.enabled~='never' and (doc.enabled=='always' or not doc.condition or matches)end}
 local before=presets:ActivationSignature(parent,context,map);matches=true
 assert(before~=presets:ActivationSignature(parent,context,map),'inactive first reuse must not hide active second instance descendants from event reconciliation')
end
