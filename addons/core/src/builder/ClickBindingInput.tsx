import { UI } from "wuira";
import { Cell, FlowLayout, Label, TextInput, Background, Border } from "wuira/ui";
import type { LumaTheme } from "../core/contract";
import { clickCombination } from "./UnitButton";

declare function IsShiftKeyDown(this: void): boolean;
declare function IsControlKeyDown(this: void): boolean;
declare function IsAltKeyDown(this: void): boolean;

interface CaptureScripts {
    SetScript(script: "OnMouseDown" | "OnChar", handler: ((this: void, frame: wuiraNativeFrame, key: string) => void) | undefined): void;
    SetScript(script: "OnEditFocusLost" | "OnHide" | "OnTextChanged", handler: ((this: void, frame: wuiraNativeFrame) => void) | undefined): void;
}
const mouseButtons: Readonly<Record<string, string>> = {
    LeftButton: "BUTTON1", RightButton: "BUTTON2", MiddleButton: "BUTTON3", Button4: "BUTTON4", Button5: "BUTTON5",
};
const mouseLabels: Readonly<Record<string, string>> = {
    "1": "Left click", "2": "Right click", "3": "Middle click", "4": "Mouse 4", "5": "Mouse 5",
};
export function clickBindingLabel(key: string): string {
    if (key === "") return "Click to bind";
    const parsed = clickCombination(key);
    const modifiers = parsed.prefix.split("-").filter(value => value !== "").map(value => value === "ctrl" ? "Ctrl" : value === "alt" ? "Alt" : "Shift");
    return [...modifiers, mouseLabels[parsed.button]].join(" + ");
}

/** Focused mouse-combination capture; the surrounding form owns the draft and persistence. */
export function ClickBindingInput({ width, value, onChange, colors }: {
    width: number; value: string; onChange: (key: string) => void; colors: LumaTheme["colors"];
}) {
    return <FlowLayout width={width} height={48} gap={2}>
        <Label height={16} text="Binding · click, then press" fontSize={10} color={colors.text} />
        <Cell width={width} height={28} clickThrough={false}
            decorations={{ background: new Background({ color: colors.background }), border: new Border({ thickness: 1, color: colors.border }) }}
            onMount={host => {
                let key = value, listening = false, painting = false, disposed = false;
                const input = new TextInput(host, { maxBytes: 128, onEscape: () => cancel() });
                const native = input.Frame as TextInput["Frame"] & CaptureScripts;
                const accent = host.CreateTexture(undefined, "OVERLAY");
                accent.SetAllPoints(host); accent.SetColorTexture(colors.accent.r, colors.accent.g, colors.accent.b, .12); accent.Hide();
                const paint = (hint?: string) => {
                    if (disposed) return;
                    painting = true;
                    native.SetText(hint ?? (listening ? "Press mouse 1–5 · Esc cancels" : clickBindingLabel(key)));
                    painting = false;
                    if (listening) accent.Show(); else accent.Hide();
                };
                const cancel = () => { listening = false; native.ClearFocus(); paint(); };
                const commit = (next: string) => { key = next; onChange(next); cancel(); };
                native.SetScript("OnMouseDown", (_frame, button) => {
                    if (InCombatLockdown()) return;
                    if (!listening) { input.Focus(); listening = true; paint(); return; }
                    const mouse = mouseButtons[button];
                    if (mouse === undefined) return;
                    commit((IsAltKeyDown() ? "ALT-" : "") + (IsControlKeyDown() ? "CTRL-" : "") + (IsShiftKeyDown() ? "SHIFT-" : "") + mouse);
                });
                native.SetScript("OnKeyDown", (_frame, pressed) => {
                    native.SetPropagateKeyboardInput(false);
                    if (InCombatLockdown()) { cancel(); return; }
                    if (pressed === "ESCAPE") { cancel(); return; }
                    if (!listening) { listening = true; paint(); }
                    if (pressed === "BACKSPACE" || pressed === "DELETE") { commit(""); return; }
                    if (!["LSHIFT", "RSHIFT", "LCTRL", "RCTRL", "LALT", "RALT"].includes(pressed)) paint("Use mouse 1–5 · Esc cancels");
                });
                native.SetScript("OnChar", () => paint());
                native.SetScript("OnTextChanged", () => { if (!painting) paint(); });
                native.SetScript("OnEditFocusLost", () => { listening = false; paint(); });
                native.SetScript("OnHide", () => cancel());
                paint();
                return () => {
                    disposed = true; listening = false; accent.Hide();
                    native.SetScript("OnMouseDown", undefined); native.SetScript("OnKeyDown", undefined);
                    native.SetScript("OnChar", undefined); native.SetScript("OnTextChanged", undefined);
                    native.SetScript("OnEditFocusLost", undefined); native.SetScript("OnHide", undefined);
                    input.Dispose();
                };
            }} />
    </FlowLayout>;
}
