import { Store } from "wuira/store";

/** Character settings owned by the LumaUI master addon. */
export class LumaSettings extends Store {
    public static readonly Token = "lumaui.settings";
    public version = 3;
    public minimapAngle = 225;
    public playerPosition = { x: 0, y: 180 };
}
