import { UI, wuira } from "wuira";
import { Button, FlowLayout, Label, Background, Border } from "wuira/ui";
import { Core } from "./core";
export interface Choice { label: string; value: string; }
/** A bounded, paged popup; it is released with its inspector control. */
export function Dropdown({ text, options, onSelect, width = 174 }: { text: string; options: Choice[]; onSelect(value: string): void; width?: number }) {
    let host: wuiraNativeFrame | undefined;
    let popup: wuiraNativeFrame | undefined;
    let page = 0;
    const close = () => { if (popup !== undefined) wuira.Unmount(popup); popup = undefined; };
    const open = () => {
        close(); if (host === undefined) return;
        popup = wuira.Mount(<FlowLayout width={width} height={Math.min(6, options.length) * 24 + 32} padding={4} gap={0}
            anchor="TOPLEFT" relativeAnchor="BOTTOMLEFT" onMount={frame => { frame.SetFrameStrata("TOOLTIP"); frame.ClearAllPoints(); frame.SetPoint("TOPLEFT", host!, "BOTTOMLEFT", 0, 0); frame.SetClampedToScreen(true); }}
            decorations={{ background: new Background({ color: Core.Theme.colors.surface }), border: new Border({ color: Core.Theme.colors.border, thickness: 1 }) }}>
            {options.slice(page * 6, page * 6 + 6).map(option => <Button height={24} onClick={() => { close(); onSelect(option.value); }}>
                <Label text={option.label} fontSize={10} color={Core.Theme.colors.text} />
            </Button>)}
            <FlowLayout height={24} direction="horizontal">
                <Button width={width / 2 - 4} onClick={() => { page = Math.max(0, page - 1); open(); }}><Label text="<" fontSize={10} /></Button>
                <Button width={width / 2 - 4} onClick={() => { page = Math.min(Math.max(0, Math.ceil(options.length / 6) - 1), page + 1); open(); }}><Label text=">" fontSize={10} /></Button>
            </FlowLayout>
        </FlowLayout>, undefined, UIParent);
    };
    return <Button width={width} height={26} onClick={() => { if (popup === undefined) open(); else close(); }}
        onMount={frame => { host = frame; return () => { close(); host = undefined; }; }}
        decorations={{ background: new Background({ color: Core.Theme.colors.border }) }}>
        <Label text={text + " v"} fontSize={10} />
    </Button>;
}
