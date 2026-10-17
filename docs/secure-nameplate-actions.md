# Secure nameplate actions: client investigation

Status: **unsupported/unverified**. No functioning HoJ nameplate import is shipped.
The visual Nameplates and BlizzardElement APIs continue to reject secure children.

The requested preset will store Paladin activation, hostile-unit matching, placement
to the left of the native visual, and the Hammer of Justice action as import data.
Neither Wuira nor Luma's generic runtime should hardcode Paladin/HoJ behavior.
It must preserve native plate visuals rather than replace the whole nameplate.

## Blockers

- In the published Blizzard implementation, SecureHandlerSetFrameRef routes through
  a protected API frame whose handler explicitly rejects combat execution. Therefore
  preallocating buttons does not establish that a newly created carrier can receive
  a secure button/reference during combat.
- Restricted SetPoint and SetParent resolve target handles with protection checks.
  A movable visual proxy is not evidence of a freely movable secure click target.
- A fixed nameplateN action is not a stable identity: its GUID and physical carrier
  may change independently. Updating an insecure field or using a generic mouseover
  macro does not prove that the clicked icon belongs to that unit.
- Fixed arena/party secure cells do not establish dynamic nameplate support.

Primary code references (upstream, not proof of the Forever client's implementation):

- [SecureHandlers.lua](https://github.com/Gethe/wow-ui-source/blob/live/Interface/AddOns/Blizzard_RestrictedAddOnEnvironment/SecureHandlers.lua), API_OnAttributeChanged and SecureHandlerSetFrameRef.
- [RestrictedFrames.lua](https://github.com/Gethe/wow-ui-source/blob/live/Interface/AddOns/Blizzard_RestrictedAddOnEnvironment/RestrictedFrames.lua), HANDLE:SetPoint and HANDLE:SetParent.

## Read-only Forever client audit

After reloading the deployed addon:

1. Outside combat: `/luma secureplates start`.
2. Enable enemy nameplates and enter combat. Bring an additional enemy/plate into
   view after combat has started; then let plates leave and reappear to exercise reuse.
3. After combat: `/luma secureplates report`, then `/luma secureplates stop`.

The audit records event timing, public identity transitions, carrier/visual protection
and whether native unit attributes exist. It never casts, creates action buttons,
changes native attributes, parents, anchors or events, or logs secret values.
Only its own observer frame receives event registrations. Captured history is bounded.
API presence and public attributes are observations, never a "supported" verdict.

The report is the next input needed from the actual client. It cannot by itself prove
correct secure click behavior. A supported engine route must still be identified and
tested before implementing the generic action manager and import factory.

## Acceptance gate for the future import

- New hostile plates get correctly positioned and clickable actions during combat.
- Clicking B while targeting A casts on B, without a fallback to A or a third unit.
- Removal, GUID/token reuse and carrier/visual reuse never leave a stale click target.
- Rule disposal/editing in combat cannot leave an action under a different visual.
- Forbidden/secret inputs do not reach filter or action attribute calculations.
- No addon action blocked/forbidden errors or taint side effects.
- Paladin activation, spell/rank selection, enemy filtering and placement remain data.

Mock Lua tests only establish that the audit is bounded and read-only, handles
restricted inputs, and keeps the feature explicitly unverified. They do not validate
secure combat nameplate actions in the game.
