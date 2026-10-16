import { UI } from "wuira";
import { resolveUnit } from "wuira/datasources";
import type { UnitInput } from "wuira/datasources";
import type { CellProps } from "wuira/ui";
import { readUnitAuras } from "./UnitAuraFilter";
interface Color { r: number; g: number; b: number; a?: number; }
interface AlphaAnimation { SetFromAlpha(alpha: number): void; SetToAlpha(alpha: number): void; SetDuration(seconds: number): void; SetSmoothing(mode: "IN_OUT"): void; }
interface AnimationGroup { SetLooping(mode: "BOUNCE"): void; CreateAnimation(type: "Alpha"): AlphaAnimation; Play(): void; Stop(): void; }
interface AnimatedTexture extends wuiraNativeTexture { SetAlpha(alpha: number): void; CreateAnimationGroup(): AnimationGroup; }
/** A fixed secure compartment's presentation. Aura changes touch textures only. */
export function unitAuraIndicator(props: Partial<CellProps>, input: UnitInput, category: string, spellId: number, movement: readonly number[], preview: boolean,
    size = 12, idle: Color = { r: .32, g: .28, b: .18, a: .7 }, alert: Color = { r: 1, g: .76, b: .2 }, hover: Color = { r: .6, g: .4, b: .15, a: .22 }) {
    const target = resolveUnit(input), movementIds = new Set(movement);
    return UI.createElement("cell", { ...props, onMount: (frame: wuiraNativeFrame) => {
        const host = frame.GetParent(), edges: wuiraNativeTexture[] = [];
        const width = host.GetWidth(), height = host.GetHeight();
        for (const [x, y, w, h] of [[0, 0, width, 1], [0, -height + 1, width, 1], [0, 0, 1, height], [width - 1, 0, 1, height]]) {
            const edge = host.CreateTexture(undefined, "OVERLAY"); edge.SetSize(w, h); edge.SetPoint("TOPLEFT", host, "TOPLEFT", x, y); edge.Show(); edges.push(edge);
        }
        const fill = host.CreateTexture(undefined, "BACKGROUND"); fill.SetAllPoints(host); fill.SetColorTexture(hover.r, hover.g, hover.b, hover.a ?? .22); fill.Hide();
        const icon = frame.CreateTexture(undefined, "OVERLAY") as AnimatedTexture;
        icon.SetSize(size, size); icon.SetPoint("CENTER", frame, "CENTER", 0, 0); icon.SetTexCoord(.07, .93, .07, .93);
        const texture = C_Spell?.GetSpellTexture?.(spellId);
        icon.SetTexture(issecretvalue(texture) ? undefined : texture ?? "Interface\\Icons\\Spell_Holy_Purify");
        icon.Show();
        const pulse = icon.CreateAnimationGroup(); pulse.SetLooping("BOUNCE");
        const alpha = pulse.CreateAnimation("Alpha"); alpha.SetFromAlpha(1); alpha.SetToAlpha(.25); alpha.SetDuration(.45); alpha.SetSmoothing("IN_OUT");
        const notice = frame.CreateFontString(undefined, "OVERLAY"); notice.SetAllPoints(frame); notice.SetFont("Fonts\\FRIZQT__.TTF", 9, "OUTLINE"); notice.SetJustifyH("CENTER");
        let active = false, disposed = false;
        const refresh = () => {
            const result = preview ? { icons: [0], restricted: false } : readUnitAuras(target.Token, category, movementIds, 1);
            const next = result.icons.length > 0;
            const color = next ? alert : idle;
            for (const edge of edges) edge.SetColorTexture(color.r, color.g, color.b, color.a ?? 1);
            notice.SetText(result.restricted && !next ? "?" : "");
            if (active !== next) { active = next; if (active && !preview) pulse.Play(); else { pulse.Stop(); icon.SetAlpha(1); } }
        };
        host.HookScript("OnEnter", () => { if (!disposed) fill.Show(); }); host.HookScript("OnLeave", () => { if (!disposed) fill.Hide(); });
        for (const event of ["UNIT_AURA", "GROUP_ROSTER_UPDATE", "PLAYER_ENTERING_WORLD"]) frame.RegisterEvent(event);
        frame.SetScript("OnEvent", (_host, event, unit) => { if (event !== "UNIT_AURA" || unit === target.Token) refresh(); });
        const stop = target.onChange(refresh); refresh();
        return () => { disposed = true; stop(); frame.UnregisterAllEvents(); frame.SetScript("OnEvent", undefined); pulse.Stop(); icon.SetAlpha(1); icon.Hide(); fill.Hide(); for (const edge of edges) edge.Hide(); notice.SetText(""); };
    } });
}
