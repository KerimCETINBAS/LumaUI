# Dynamic Blizzard elements

LumaUI exposes `Skins.BlizzardElement`, `Skins.RegisterElement` and
`Helpers.UnitToBool`. Wuira 0.2.7 owns native frames, events, unit bindings and
restoration. Luma owns matching conditions and authored templates.

## JSX

Given the existing Luma core API as `Core`:

```tsx
import { UI } from "wuira";
import { HP } from "wuira/datasources";

const { BlizzardElement } = Core.Skins;
const filter = Core.Helpers.UnitToBool({ player: false, attackable: true });

const rule = (
    <BlizzardElement type="dynamic" target="nameplate" filter={filter} replace>
        {plate => <progress width={140} height={12} source={new HP(plate.Unit)} />}
    </BlizzardElement>
);
```

Mount the zero-size host inside the owning component; unmounting removes only its
rule group. Replacement children must be factories, not shared JSX. Register
additional manual subscriptions immediately with `plate.OnDispose(...)`.

Apply reuses native bars:

```tsx
<BlizzardElement type="dynamic" target="nameplate" filter={filter} apply
    width={140} height={12} scale={1}
    healthColor={{ r: 0.2, g: 0.7, b: 0.4 }} />
```

Apply accepts health-bar `width` / `height`, native visual `scale` / `alpha`,
`healthColor` and `castColor`. Operations are mutually exclusive. Style Replace
through its child template, not native style properties. Only dynamic nameplates
are supported; secure controls need a separate lifecycle.

For programmatic collections use `Core.Skins.RegisterElement(...)` inside
`collection.forEach(...)`; retain and dispose the returned handles. Every call
owns one rule group. Across both operations and all groups, **the first registered
matching rule wins**. Specific rules go before fallbacks; Apply does not stack
on Replace. Disposing a winner restores it and activates the next matching rule.

## Unit → boolean converter

`Core.Helpers.UnitToBool(options)` is a stateless predicate accepting a unit token
or Wuira UnitSource. Saved documents use the `unitToBool` source and its `MatchUnit`
capability. Options are copied at creation; re-register the owning component after
changing filter data.

| Option | Match |
| --- | --- |
| `npcIds` | Any numeric NPC ID in a public Creature/Vehicle GUID |
| `name` | Exact name |
| `classes` | Any comma-separated class token, e.g. `MAGE,WARRIOR` |
| `player` | Whether it is a player |
| `friendly` | Native friendship to the player |
| `attackable` | Whether the player can attack it |

Conditions combine with AND; lists use OR. Empty options match all existing
public units. An empty NPC list matches none. Missing or secret data never matches.
No class or NPC presets are built into Wuira.

## Documents and editor

This is the source/root portion of an ordinary version-1 preset:

```ts
{
    sources: [
        { name: "enemies", type: "unitToBool", props: { player: false, attackable: true } },
        { name: "health", type: "hp", props: { unit: "$unit" } },
    ],
    root: {
        id: "plates", type: "blizzardElement",
        props: { type: "dynamic", target: "nameplate", replace: true, filter: "enemies" },
        children: [{ id: "healthbar", type: "progress", source: "health", props: { width: 140, height: 12 } }],
    },
}
```

Replace requires one visual template and creates an isolated `$unit` source scope
per binding. `$pet` is unavailable. The root attaches to the carrier instead of
an old screen position. Preset references work; secure controls and headless effects
inside templates are rejected, including through referenced presets. Register
rules outside ForEach item templates. A headless fragment can contain several rules.

The editor tool creates a filter source and child template. Its inspector selects
filter and operation. Switching to Apply removes the template; Undo restores it.
Converter fields are editable under Sources. Preview renders a sample replacement
and never registers live rules. Apply has no preview tree.

Wuira reevaluates matching on nameplate, identity, name, faction, target and world
events. Health updates use source events without polling selectors. Removal,
identity changes and failures release per-unit sources. A failed factory leaves
native visuals visible. Apply styling can be overwritten by Blizzard/other addons;
it is not continuously enforced. Native targeting, positioning and click bounds
stay with the engine.

The compiled Lua tests run against mock WoW APIs. Real-client behavior and dynamic
secure nameplate buttons remain unverified.
