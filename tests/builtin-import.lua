-- Tests install the same wire assets as an explicitly confirmed import.
local function importBuiltin(core,registry,key)
 local transfer=new(registry.require('builder.transfer.PresetTransfer').PresetTransfer,core)
 local payload=transfer:Decode(assert(core.BuiltinPresets[key]),'preset')
 transfer:PrepareClickCast(payload)
 return payload.document
end
