import { Tooltip } from "wuira/ui";
import type { SecureAction } from "wuira/ui";

declare const C_Spell: { GetSpellInfo?: (this: void, spell: number | string) => { spellID: number } | undefined } | undefined;
declare const C_Item: { GetItemInfoInstant?: (this: void, item: string) => wuiraNativeReturns<[number | undefined]> } | undefined;
declare const GetItemInfoInstant: ((this: void, item: string) => wuiraNativeReturns<[number | undefined]>) | undefined;

/** Route current action data into GameTooltip; the native bridge is owned by wuira. */
export function actionTooltip(read: () => SecureAction | undefined): Tooltip {
    return new Tooltip({ show: tooltip => {
        const action = read();
        if (action === undefined) return false;
        if (action.type === "spell") {
            const id = typeof action.spell === "number" ? action.spell : C_Spell?.GetSpellInfo?.(action.spell)?.spellID;
            if (id !== undefined && !issecretvalue(id)) tooltip.SetSpellByID(id);
            else tooltip.SetText(String(action.spell));
        } else if (action.type === "item") {
            if (typeof action.item === "number") tooltip.SetItemByID(action.item);
            else if (action.item.includes("item:")) tooltip.SetHyperlink(action.item);
            else {
                const lookup = C_Item?.GetItemInfoInstant ?? GetItemInfoInstant;
                const [id] = lookup === undefined ? [undefined] : lookup(action.item);
                if (id !== undefined && !issecretvalue(id)) tooltip.SetItemByID(id);
                else tooltip.SetText(action.item);
            }
        } else if (action.type === "action") tooltip.SetAction(action.slot);
        else if (action.type === "target") tooltip.SetUnit(action.unit);
        else tooltip.SetText(String(action.macro));
    } });
}
