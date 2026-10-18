import { UI } from "wuira/ui";
import { wuira } from "wuira";
import { Cell, FlowLayout, Button, Background, Border, Tooltip, ScrollHost, Icon } from "wuira/ui";
import type { SearchChoice, SearchProvider } from "./SearchDropdown";
import { SearchDropdown } from "./SearchDropdown";
import { Core } from "../core";
import { Glyph } from "../chrome/Glyph";
import { SingleLine } from "../chrome/SingleLine";
/** A reusable list editor: object identity is its value, presentation comes from the catalog. */
export function ArrayInput({ width, values, describe, provider, onChange, single = false, placeholder = "Search to add an item" }: {
    width: number; values: string[]; describe(value: string): SearchChoice; provider: (selected: readonly string[]) => SearchProvider;
    onChange(values: string[]): void; single?: boolean; placeholder?: string;
}) {
    const colors = Core.Theme.colors, height = single ? 32 : 112;
    let current = [...values], scroll: ScrollHost | undefined, content: wuiraNativeFrame | undefined, count: wuiraNativeFontString | undefined;
    let host: wuiraNativeFrame | undefined, dirty = false, revision = 0;
    const source: SearchProvider = {
        Search: query => provider(current).Search(query),
        Revision: () => revision + (provider(current).Revision?.() ?? 0),
        Pump: query => provider(current).Pump?.(query) ?? false,
        Status: () => provider(current).Status?.() ?? "",
    };
    const render = () => {
        if (scroll === undefined) return;
        const rowWidth = width - 8;
        const view = <FlowLayout width={rowWidth} height={Math.max(32, current.length * 34)} gap={2}>
            {current.length === 0 ? <SingleLine width={rowWidth} height={32} text="No selection" size={10} color={colors.muted} /> : current.map((value, index) => {
                const item = describe(value);
                return <FlowLayout width={rowWidth} height={32} direction="horizontal" gap={4}
                    decorations={{ background: new Background({ color: colors.surface }), tooltip: new Tooltip({ text: item.hint ?? item.label }) }}>
                    {item.icon === undefined ? <Cell width={24} height={32} padding={{ left: 5, top: 9 }}><Glyph name="component" /></Cell> : <Icon width={24} height={24} margin={{ top: 4 }} texture={item.icon} />}
                    <FlowLayout width={rowWidth - 60} height={32} gap={0}>
                        <SingleLine width={rowWidth - 60} height={17} text={item.label} size={10} />
                        <SingleLine width={rowWidth - 60} height={13} text={item.detail ?? ""} size={8} color={colors.muted} />
                    </FlowLayout>
                    <Button width={28} height={28} margin={{ top: 2 }} onClick={() => { current = current.filter((_item, i) => i !== index); revision++; onChange([...current]); dirty = true; }}
                        decorations={{ tooltip: new Tooltip({ text: "Remove " + item.label }) }}>
                        <Cell width={28} height={28} padding={7}><Glyph name="close" color={colors.muted} /></Cell>
                    </Button>
                </FlowLayout>;
            })}
        </FlowLayout>;
        const next = wuira.Mount(view, undefined, scroll.Frame), previous = content; content = next;
        const offset = scroll.Frame.GetVerticalScroll(); scroll.SetContent(next!, offset); if (previous !== undefined) wuira.Unmount(previous);
        count?.SetText(current.length + (single ? " selected" : " selected · scroll to browse")); dirty = false;
    };
    return <FlowLayout width={width} height={height + 54} gap={4}>
        <SearchDropdown width={width} provider={source} placeholder={placeholder} onSelect={choice => {
            if (!single && (current.includes(choice.value) || current.length >= 256)) return;
            current = single ? [choice.value] : [...current, choice.value];
            revision++; onChange([...current]); dirty = true;
        }} />
        <Cell width={width} height={height} decorations={{ border: new Border({ thickness: 1, color: colors.border }) }} onMount={frame => {
            host = frame; const viewport = new ScrollHost(frame); scroll = viewport; render();
            frame.SetScript("OnUpdate", () => { if (dirty) render(); });
            return () => { frame.SetScript("OnUpdate", undefined); if (content !== undefined) wuira.Unmount(content); content = undefined; viewport.Dispose(); if (scroll === viewport) scroll = undefined; if (host === frame) host = undefined; };
        }} />
        <Cell width={width} height={14} onMount={frame => {
            const label = frame.CreateFontString(undefined, "OVERLAY"); count = label; label.SetAllPoints(frame); label.SetFont("Fonts\\FRIZQT__.TTF", 9, "");
            label.SetJustifyH("LEFT"); label.SetTextColor(colors.muted.r, colors.muted.g, colors.muted.b, 1);
            label.SetText(current.length + (single ? " selected" : " selected · scroll to browse"));
            return () => { if (count === label) count = undefined; };
        }} />
    </FlowLayout>;
}
