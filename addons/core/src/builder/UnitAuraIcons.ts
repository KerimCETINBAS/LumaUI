import { UI } from "wuira";
import type { CellProps } from "wuira/ui";
import { resolveUnit } from "wuira/datasources";
import type { UnitInput } from "wuira/datasources";

interface AuraChrome { border: { r: number; g: number; b: number; a?: number }; hover?: { r: number; g: number; b: number; a?: number }; }
import { readUnitAuras } from "./UnitAuraFilter";

/** Fixed visual slots. Aura changes never create, remove or reconfigure secure click targets. */
export function unitAuraIcons(props: Partial<CellProps>, input: UnitInput, category: string, movement: readonly number[], preview: boolean, maxIcons = 4, size = 16, chrome?: AuraChrome) {
    const target = resolveUnit(input);
    const movementIds = new Set(movement);
    return UI.createElement("cell", { ...props, onMount: (frame: wuiraNativeFrame) => {
        const icons: wuiraNativeTexture[] = [];
        const edges: wuiraNativeTexture[] = [];
        const host = frame.GetParent();
        let fill: wuiraNativeTexture | undefined;
        let active = false, hovered = false;
        if (chrome !== undefined) {
            const w = host.GetWidth(), h = host.GetHeight();
            for (const [x, y, width, height] of [[0, 0, w, 1], [0, -h + 1, w, 1], [0, 0, 1, h], [w - 1, 0, 1, h]]) {
                const edge = host.CreateTexture(undefined, "OVERLAY"); edge.SetSize(width, height); edge.SetPoint("TOPLEFT", host, "TOPLEFT", x, y);
                edge.SetColorTexture(chrome.border.r, chrome.border.g, chrome.border.b, chrome.border.a ?? 1); edges.push(edge);
            }
            if (chrome.hover !== undefined) {
                fill = host.CreateTexture(undefined, "BACKGROUND"); fill.SetAllPoints(host);
                fill.SetColorTexture(chrome.hover.r, chrome.hover.g, chrome.hover.b, chrome.hover.a ?? .22); fill.Hide();
            }
        }
        const showChrome = (visible: boolean) => {
            active = visible;
            for (const edge of edges) { if (visible) edge.Show(); else edge.Hide(); }
            if (visible && hovered) fill?.Show(); else fill?.Hide();
        };
        if (chrome !== undefined) {
            host.SetScript("OnEnter", () => { hovered = true; showChrome(active); });
            host.SetScript("OnLeave", () => { hovered = false; showChrome(active); });
        }
        for (let index = 0; index < maxIcons; index++) {
            const texture = frame.CreateTexture(undefined, "OVERLAY");
            texture.SetSize(size, size); texture.SetPoint("LEFT", frame, "LEFT", index * (size + 1), 0);
            texture.SetTexCoord(.07, .93, .07, .93); icons.push(texture);
        }
        const notice = frame.CreateFontString(undefined, "OVERLAY");
        notice.SetAllPoints(frame); notice.SetFont("Fonts\\FRIZQT__.TTF", 9, "OUTLINE"); notice.SetJustifyH("CENTER");
        const refresh = () => {
            const unit = target.Token;
            for (const icon of icons) icon.Hide(); notice.SetText(""); showChrome(false);
            if (preview) {
                for (let index = 0; index < Math.min(maxIcons, 2); index++) {
                    icons[index].SetTexture(category === "movement" ? "Interface\\Icons\\Spell_Frost_FrostNova" : category === "dispellable" ? "Interface\\Icons\\Spell_Nature_NullifyDisease" : "Interface\\Icons\\Spell_Holy_SealOfWisdom"); icons[index].Show();
                }
                showChrome(true); return;
            }
            const result = readUnitAuras(unit, category, movementIds, maxIcons);
            const count = result.icons.length, restricted = result.restricted;
            for (let index = 0; index < count; index++) { icons[index].SetTexture(result.icons[index]); icons[index].Show(); }
            // An unavailable category is distinct from a known empty list.
            if (restricted && count === 0) notice.SetText("?");
            showChrome(count > 0 || restricted);
        };
        for (const event of ["UNIT_AURA", "GROUP_ROSTER_UPDATE", "PLAYER_ENTERING_WORLD"]) frame.RegisterEvent(event);
        frame.SetScript("OnEvent", (_host, event, changed) => { if (event !== "UNIT_AURA" || changed === target.Token) refresh(); }); const stopUnit = target.onChange(refresh); refresh();
        return () => {
            stopUnit(); frame.UnregisterAllEvents(); frame.SetScript("OnEvent", undefined);
            if (chrome !== undefined) { host.SetScript("OnEnter", undefined); host.SetScript("OnLeave", undefined); }
            for (const icon of icons) icon.Hide(); showChrome(false); notice.SetText("");
        };
    } });
}
