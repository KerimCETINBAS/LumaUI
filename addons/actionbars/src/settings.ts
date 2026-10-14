import { Store } from "wuira/store";
export class ActionBarSettings extends Store {
    public static readonly Token = "lumaui.action-bars";
    public position = { x: 0, y: 340 };
    public bindings: Record<string, string> = {};
    public migrated = false;
    public collectionSeeded = false;
}
