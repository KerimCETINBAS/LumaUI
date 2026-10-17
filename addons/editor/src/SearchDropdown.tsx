import { UI, wuira } from "wuira";
import { Cell, FlowLayout, Button, Background, Border, Tooltip, TextInput, ScrollHost, Icon } from "wuira/ui";
import { Core } from "./core";
import { SingleLine } from "./SingleLine";
import { Glyph } from "./Glyph";
export interface SearchChoice { value: string; label: string; detail?: string; icon?: number | string; hint?: string; }
export interface SearchProvider {
    Search(query: string): SearchChoice[];
    Pump?(query: string): boolean;
    Status?(): string;
    Revision?(): number;
}
let active: (() => void) | undefined;
/** Local result updates retain native text focus; one popup is open at a time. */
export function SearchDropdown({ width, provider, onSelect, placeholder = "Search..." }: {
    width: number; provider: SearchProvider; onSelect(choice: SearchChoice): void; placeholder?: string;
}) {
    const colors = Core.Theme.colors;
    let input: TextInput | undefined, host: wuiraNativeFrame | undefined, popup: wuiraNativeFrame | undefined;
    let content: wuiraNativeFrame | undefined, scroll: ScrollHost | undefined, status: wuiraNativeFontString | undefined;
    let query = "", dirty = false, delay = 0, openState = false, revision = provider.Revision?.();
    const close = () => {
        openState = false; if (active === close) active = undefined;
        if (popup !== undefined) wuira.Unmount(popup);
        popup = undefined; content = undefined; scroll = undefined; status = undefined;
    };
    const render = () => {
        if (scroll === undefined) return;
        const choices = provider.Search(query);
        const rowWidth = width - 16;
        const view = <FlowLayout width={rowWidth} height={Math.max(36, choices.length * 38)} gap={2}>
            {choices.length === 0 ? <SingleLine width={rowWidth} height={36} size={10} color={colors.muted}
                text={query.trim() === "" ? "Type a name to search" : "No matching choices"} /> : choices.map(choice =>
                <Button width={rowWidth} height={36} onClick={() => { onSelect(choice); dirty = true; delay = 0; input?.Focus(false); }}
                    decorations={{ background: new Background({ color: colors.border }), tooltip: new Tooltip({ text: choice.hint ?? choice.label }) }}>
                    <FlowLayout width={rowWidth} height={36} direction="horizontal" padding={3} gap={6}>
                        {choice.icon === undefined ? <Cell width={28} height={28} padding={7}><Glyph name="component" /></Cell> : <Icon width={28} height={28} texture={choice.icon} />}
                        <FlowLayout width={rowWidth - 40} height={30} gap={0}>
                            <SingleLine width={rowWidth - 40} height={16} text={choice.label} size={10} />
                            <SingleLine width={rowWidth - 40} height={14} text={choice.detail ?? ""} size={9} color={colors.muted} />
                        </FlowLayout>
                    </FlowLayout>
                </Button>)}
        </FlowLayout>;
        const next = wuira.Mount(view, undefined, scroll.Frame), previous = content; content = next;
        scroll.SetContent(next!, 0); if (previous !== undefined) wuira.Unmount(previous);
        dirty = false;
    };
    const open = () => {
        if (openState || host === undefined) return;
        active?.(); active = close; openState = true;
        popup = wuira.Mount(<Cell width={width} height={252} padding={4} clickThrough={false}
            decorations={{ background: new Background({ color: colors.background }), border: new Border({ thickness: 1, color: colors.border }) }}
            onMount={frame => {
                frame.SetFrameStrata("TOOLTIP"); frame.ClearAllPoints(); frame.SetPoint("TOPLEFT", host!, "BOTTOMLEFT", 0, -2); frame.SetClampedToScreen(true);
                frame.SetScript("OnUpdate", (_frame, elapsed) => {
                    const nextRevision = provider.Revision?.();
                    if (nextRevision !== revision) { revision = nextRevision; dirty = true; }
                    if (provider.Pump?.(query)) dirty = true;
                    delay = Math.max(0, delay - elapsed);
                    if (dirty && delay === 0) render();
                    status?.SetText((query === "" ? "Search by name" : "Up to 48 results · refine to narrow") + (provider.Status === undefined ? "" : " · " + provider.Status()));
                });
                return () => { frame.SetScript("OnUpdate", undefined); };
            }}>
            <FlowLayout width={width - 8} height={244} gap={4}>
                <Cell width={width - 8} height={218} onMount={frame => {
                    const viewport = new ScrollHost(frame); scroll = viewport; render();
                    return () => { if (content !== undefined) wuira.Unmount(content); content = undefined; viewport.Dispose(); if (scroll === viewport) scroll = undefined; };
                }} />
                <Cell width={width - 8} height={18} onMount={frame => {
                    const label = frame.CreateFontString(undefined, "OVERLAY"); status = label; label.SetAllPoints(frame); label.SetFont("Fonts\\FRIZQT__.TTF", 8, "");
                    label.SetJustifyH("LEFT"); label.SetTextColor(colors.muted.r, colors.muted.g, colors.muted.b, 1);
                    return () => { if (status === label) status = undefined; };
                }} />
            </FlowLayout>
        </Cell>, undefined, UIParent);
    };
    return <FlowLayout width={width} height={28} direction="horizontal" gap={0}>
        <Cell width={width - 28} height={28} clickThrough={false}
            decorations={{ background: new Background({ color: colors.background }), border: new Border({ thickness: 1, color: colors.border }), tooltip: new Tooltip({ text: placeholder, lines: [{ text: "Select a result. Escape closes the list." }] }) }}
            onMount={frame => {
                host = frame;
                const box = new TextInput(frame, { text: query, maxBytes: 128, onEscape: () => { close(); box.Frame.ClearFocus(); } }); input = box;
                const hint = frame.CreateFontString(undefined, "OVERLAY"); hint.SetAllPoints(frame); hint.SetFont("Fonts\\FRIZQT__.TTF", 10, ""); hint.SetJustifyH("LEFT"); hint.SetTextColor(colors.muted.r, colors.muted.g, colors.muted.b, 1); hint.SetText(query === "" ? placeholder : "");
                const native = box.Frame as typeof box.Frame & { SetScript(script: "OnTextChanged" | "OnEditFocusGained" | "OnEnterPressed", handler: (() => void) | undefined): void };
                native.SetScript("OnEditFocusGained", open);
                native.SetScript("OnTextChanged", () => { query = box.Value; hint.SetText(query === "" ? placeholder : ""); dirty = true; delay = .12; open(); });
                native.SetScript("OnEnterPressed", () => { const choices = provider.Search(query); if (choices.length === 1) { onSelect(choices[0]); dirty = true; delay = 0; } });
                return () => { hint.SetText(""); close(); native.SetScript("OnTextChanged", undefined); native.SetScript("OnEditFocusGained", undefined); native.SetScript("OnEnterPressed", undefined); box.Dispose(); if (input === box) { input = undefined; host = undefined; } };
            }} />
        <Button width={28} height={28} onClick={() => { if (openState) close(); else { open(); input?.Focus(false); } }}
            decorations={{ background: new Background({ color: colors.border }), tooltip: new Tooltip({ text: placeholder }) }}>
            <Cell width={28} height={28} padding={7}><Glyph name="search" /></Cell>
        </Button>
    </FlowLayout>;
}
