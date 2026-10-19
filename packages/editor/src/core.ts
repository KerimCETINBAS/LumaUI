import type { LumaCoreAPI } from "lumaui/core";
declare const LumaUI: LumaCoreAPI | undefined;
if (LumaUI === undefined) throw "LumaUI.Editor requires the LumaUI master addon";
export const Core = LumaUI;
