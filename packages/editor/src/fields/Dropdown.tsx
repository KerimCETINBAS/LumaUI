import { UI } from "wuira/ui";
import { wuira } from "wuira";
import { Button, Cell, FlowLayout, Label, Background, Border, ScrollHost } from "wuira/ui";
import { Core } from "../core";
import { Glyph } from "../chrome/Glyph";
import { SingleLine } from "../chrome/SingleLine";
export interface Choice { label: string; value: string; }
/** One native scrollable list; long option lists never require paging buttons. */
export function Dropdown({ text, options, onSelect, width = 174 }: { text: string; options: Choice[]; onSelect(value: string): void; width?: number }) {
    let host: wuiraNativeFrame | undefined, popup: wuiraNativeFrame | undefined;
    const close = () => { if (popup !== undefined) wuira.Unmount(popup); popup = undefined; };
    const open = () => {
        close(); if (host === undefined) return;
        const height = Math.max(28, Math.min(7, options.length) * 28);
        popup = wuira.Mount(<Cell width={width} height={height + 8} padding={4} clickThrough={false}
            onMount={frame => { frame.SetFrameStrata("TOOLTIP"); frame.ClearAllPoints(); frame.SetPoint("TOPLEFT", host!, "BOTTOMLEFT", 0, 0); frame.SetClampedToScreen(true); }}
            decorations={{ background: new Background({ color: Core.Theme.colors.surface }), border: new Border({ color: Core.Theme.colors.border, thickness: 1 }) }}>
            <Cell width={width - 8} height={height} onMount={frame => {
                const scroll = new ScrollHost(frame);
                let content: wuiraNativeFrame | undefined;
                try {
                    content = wuira.Mount(<FlowLayout width={width - 16} height={Math.max(28, options.length * 28)} gap={0}>
                        {options.length === 0 ? <Label height={28} text="No options" fontSize={10} color={Core.Theme.colors.muted} /> : options.map(option => <Button width={width - 16} height={28} onClick={() => { close(); onSelect(option.value); }}>
                            <SingleLine width={width - 20} height={28} text={option.label} size={10} color={Core.Theme.colors.text} />
                        </Button>)}
                    </FlowLayout>, undefined, scroll.Frame);
                    const selected = options.findIndex(option => option.label === text || option.value === text);
                    scroll.SetContent(content!, Math.max(0, selected - 1) * 28);
                } catch (failure) { scroll.Dispose(); if (content !== undefined) wuira.Unmount(content); throw failure; }
                return () => { if (content !== undefined) wuira.Unmount(content); scroll.Dispose(); };
            }} />
        </Cell>, undefined, UIParent);
    };
    return <Button width={width} height={26} onClick={() => { if (popup === undefined) open(); else close(); }}
        onMount={frame => { host = frame; return () => { close(); host = undefined; }; }}
        decorations={{ background: new Background({ color: Core.Theme.colors.border }) }}>
        <FlowLayout width={width} height={26} direction="horizontal" gap={4} padding={{ left: 6, right: 6, top: 6 }}><SingleLine width={Math.max(0, width - 30)} height={14} text={text} size={10} color={Core.Theme.colors.text} /><Glyph name="chevron-down" size={14} /></FlowLayout>
    </Button>;
}
