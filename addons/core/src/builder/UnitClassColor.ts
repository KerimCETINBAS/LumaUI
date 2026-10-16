import { resolveUnit } from "wuira/datasources";
import type { UnitInput } from "wuira/datasources";

declare function UnitClass(this: void, unit: string): wuiraNativeReturns<[string | undefined, string | undefined]>;
declare const RAID_CLASS_COLORS: Record<string, { r: number; g: number; b: number }>;

/** Bind class styling to the same unit identity used by the secure action. */
export function bindUnitClassColor(frame: wuiraNativeFrame, input: UnitInput, background: boolean, border: boolean, preview: boolean): () => void {
    const target = resolveUnit(input);
    const textures: wuiraNativeTexture[] = [];
    if (background) {
        const fill = frame.CreateTexture(undefined, "BACKGROUND");
        fill.SetAllPoints(frame); textures.push(fill);
    }
    if (border) {
        const w = frame.GetWidth(), h = frame.GetHeight();
        for (const [x, y, width, height] of [[0, 0, w, 1], [0, -h + 1, w, 1], [0, 0, 1, h], [w - 1, 0, 1, h]]) {
            const edge = frame.CreateTexture(undefined, "OVERLAY");
            edge.SetPoint("TOPLEFT", frame, "TOPLEFT", x, y); edge.SetSize(width, height); textures.push(edge);
        }
    }
    const refresh = () => {
        const [, token] = UnitClass(target.Token);
        let color = issecretvalue(token) || token === undefined ? undefined : RAID_CLASS_COLORS[token];
        if (preview && color === undefined) {
            const [, playerClass] = UnitClass("player");
            if (!issecretvalue(playerClass) && playerClass !== undefined) color = RAID_CLASS_COLORS[playerClass];
        }
        for (const texture of textures) texture.SetColorTexture(color?.r ?? .35, color?.g ?? .4, color?.b ?? .45, 1);
    };
    const events = CreateFrame("Frame", undefined, UIParent);
    for (const event of ["UNIT_NAME_UPDATE", "GROUP_ROSTER_UPDATE", "PLAYER_ENTERING_WORLD"]) events.RegisterEvent(event);
    events.SetScript("OnEvent", () => refresh());
    const stopUnit = target.onChange(refresh);
    refresh();
    return () => {
        stopUnit(); events.UnregisterAllEvents(); events.SetScript("OnEvent", undefined); events.Hide();
        for (const texture of textures) texture.Hide();
    };
}
