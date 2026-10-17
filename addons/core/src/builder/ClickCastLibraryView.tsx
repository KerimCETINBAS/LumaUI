import { UI, wuira } from "wuira";
import { FlowLayout, Cell, ScrollHost, Label, Button, TextInput, Background, Border } from "wuira/ui";
import type { ClickCastPresetDocument, LumaCoreAPI, ClickCastAction, ClickCastTraits, ClickCastTargeting } from "../core/contract";

import { ActionPicker } from "./ActionPicker";
import { ClickBindingInput } from "./ClickBindingInput";
import { clickCastTraits } from "./ClickCastTraits";
import { actionLabel } from "../helpers/PlayerActions";
import { ControlContent, controlIcon } from "../theme/ControlContent";
interface BindingDraft { id: number; key: string; action?: ClickCastAction; targeting: ClickCastTargeting; traits: ClickCastTraits; }

export function installClickCastLibrary(core: LumaCoreAPI): void {
    const picker = new ActionPicker(core);
    let pageHost: wuiraNativeFrame | undefined;
    let editing: string | undefined;
    let nextRow = 1;
    let name = "", message = "";
    const newRow = (key: string): BindingDraft => ({ id: nextRow++, key, targeting: "mouseover",
        traits: clickCastTraits({ onlyTarget: true, friendly: true, enemy: true, nodead: true, clearTargeting: true }) });
    let bindings: BindingDraft[] = [newRow("BUTTON1")];
    let listScroll: ScrollHost | undefined, bindingScroll: ScrollHost | undefined;
    let listOffset = 0, bindingOffset = 0;
    const inputs = new Map<string, { input: TextInput; write(value: string): void }>();
    const colors = core.Theme.colors;
    const refresh = () => core.RefreshCustomization();
    const flush = () => { for (const entry of inputs.values()) entry.write(entry.input.Value); };
    const load = (preset?: ClickCastPresetDocument) => {
        picker.Close();
        editing = preset?.id; name = preset?.name ?? "";
        bindings = preset === undefined ? [newRow("BUTTON1")]
            : preset.bindings.map(binding => ({ id: nextRow++, key: binding.key, targeting: binding.targeting ?? "direct",
                traits: clickCastTraits(binding.traits),
                action: binding.spellId !== undefined ? { spellId: binding.spellId } : binding.itemId !== undefined ? { itemId: binding.itemId } : { macro: binding.macro! } }));
        bindingOffset = 0;
    };
    const control = (text: string, onClick: () => void, width: number) => <Button width={width} height={26} onClick={onClick}
        decorations={{ background: new Background({ color: colors.border }) }}><ControlContent text={text} icon={controlIcon(text)} width={width} height={26} /></Button>;
    const field = (key: string, title: string, width: number, value: string, write: (value: string) => void, maxBytes: number) => <FlowLayout width={width} height={48} gap={2}>
        <Label height={16} text={title} fontSize={10} color={colors.text} />
        <Cell width={width} height={28} clickThrough={false}
            decorations={{ background: new Background({ color: colors.background }), border: new Border({ thickness: 1, color: colors.border }) }}
            onMount={frame => {
                const input = new TextInput(frame, { text: value, maxBytes });
                const entry = { input, write }; inputs.set(key, entry);
                const native = input.Frame as typeof input.Frame & { SetScript(script: "OnTextChanged", handler: (() => void) | undefined): void };
                native.SetScript("OnTextChanged", () => write(input.Value));
                return () => { if (inputs.get(key) === entry) inputs.delete(key); native.SetScript("OnTextChanged", undefined); input.Dispose(); };
            }} />
    </FlowLayout>;
    const viewport = (width: number, height: number, view: ReturnType<typeof UI.createElement>, bindingList: boolean) => <Cell width={width} height={height} clickThrough={false} onMount={host => {
        const scroll = new ScrollHost(host, offset => { if (bindingList) bindingOffset = offset; else listOffset = offset; });
        if (bindingList) bindingScroll = scroll; else listScroll = scroll;
        let content: wuiraNativeFrame | undefined;
        try { content = wuira.Mount(view, undefined, scroll.Frame); scroll.SetContent(content!, bindingList ? bindingOffset : listOffset); }
        catch (failure) { if (content !== undefined) wuira.Unmount(content); scroll.Dispose(); throw failure; }
        return () => {
            if (content !== undefined) wuira.Unmount(content); scroll.Dispose();
            if (bindingScroll === scroll) bindingScroll = undefined;
            if (listScroll === scroll) listScroll = undefined;
        };
    }} />;
    core.RegisterPage({ id: "click-cast", title: "Click Cast", summary: "Share multiple mouse/action bindings across secure unit buttons.", Render: context => {
        const named = core.ClickCastPresets.List();
        const width = context.width - 20;
        const libraryWidth = Math.max(160, Math.min(260, width * .32));
        const formWidth = width - libraryWidth - 8;
        const workspaceHeight = Math.max(160, context.height - 158);
        const listWidth = libraryWidth - 28;
        const formInner = formWidth - 16;
        const bindingsWidth = formInner - 12;
        const rowWidth = bindingsWidth - 12;
        const col = (rowWidth - 40) / 2;
        const bindingsHeight = Math.max(28, workspaceHeight - 132 - (message === "" ? 0 : 38));
        const rows = named.map(item => <FlowLayout width={listWidth} height={76} padding={4} gap={2}
            decorations={{ background: new Background({ color: colors.background }) }}>
            <Label height={18} text={item.name} fontSize={11} />
            <Label height={18} text={item.bindings.length + " bindings"} fontSize={10} color={colors.muted} />
            <FlowLayout height={26} direction="horizontal" gap={4}>
                {control("Edit", () => { flush(); load(item); message = ""; refresh(); }, (listWidth - 12) / 2)}
                {control("Delete", () => {
                    flush();
                    try { core.ClickCastPresets.Delete(item.id); if (editing === item.id) load(); message = "Preset deleted."; }
                    catch (failure) { message = String(failure); }
                    refresh();
                }, (listWidth - 12) / 2)}
            </FlowLayout>
        </FlowLayout>);
        const bindingRows = bindings.map(binding => <FlowLayout width={bindingsWidth} height={140} padding={6} gap={4}
            decorations={{ background: new Background({ color: colors.background }) }}>
            <FlowLayout width={rowWidth} height={48} direction="horizontal" gap={6}>
            <ClickBindingInput width={col} value={binding.key} onChange={value => { binding.key = value; }} colors={colors} />
            <FlowLayout width={col} height={48} gap={2}>
                <Label height={16} text="Action" fontSize={10} />
                {control(binding.action === undefined ? "Choose action..." : actionLabel(binding.action), () => { flush(); picker.Open(action => { binding.action = action; if (action.macro !== undefined) binding.targeting = "direct"; message = ""; refresh(); }); }, col)}
            </FlowLayout>
            <Button width={28} height={26} margin={{ top: 18 }} onClick={() => {
                picker.Close(); flush(); bindings = bindings.filter(row => row.id !== binding.id); message = ""; refresh();
            }} decorations={{ background: new Background({ color: colors.border }) }}><Label text="X" align="CENTER" fontSize={10} /></Button>
            </FlowLayout>
            <FlowLayout width={rowWidth} height={26} direction="horizontal" gap={4}>
                {(["direct", "mouseover"] as const).map(mode => control((binding.targeting === mode ? "[x] " : "[ ] ") + (mode === "direct" ? "Direct secure action" : "Mouseover macro"), () => {
                    flush();
                    if (mode === "mouseover" && binding.action?.macro !== undefined) message = "Named macros control their own targeting. Choose a spell or item for Mouseover macro.";
                    else { binding.targeting = mode; message = ""; }
                    refresh();
                }, (rowWidth - 4) / 2))}
            </FlowLayout>
            <FlowLayout width={rowWidth} height={26} direction="horizontal" gap={4}>
                {control((binding.traits.friendly ? "[x] " : "[ ] ") + "Friendly", () => { flush(); binding.traits = { ...binding.traits, friendly: !binding.traits.friendly }; refresh(); }, (rowWidth - 12) / 4)}
                {control((binding.traits.enemy ? "[x] " : "[ ] ") + "Enemy", () => { flush(); binding.traits = { ...binding.traits, enemy: !binding.traits.enemy }; refresh(); }, (rowWidth - 12) / 4)}
                {binding.targeting === "direct" ? [] : [
                    control((binding.traits.nodead ? "[x] " : "[ ] ") + "Living only", () => { flush(); binding.traits = { ...binding.traits, nodead: !binding.traits.nodead }; refresh(); }, (rowWidth - 12) / 4),
                    control((binding.traits.clearTargeting ? "[x] " : "[ ] ") + "Clear targeting", () => { flush(); binding.traits = { ...binding.traits, clearTargeting: !binding.traits.clearTargeting }; refresh(); }, (rowWidth - 12) / 4),
                ]}
            </FlowLayout>
            <Label width={rowWidth} height={16} fontSize={9} color={colors.muted} text={binding.targeting === "mouseover"
                ? "Hovered unit only; no fallback. Turn Living only off for resurrection."
                : binding.action?.macro !== undefined ? "Named macro keeps its own target rules." : "Native cast behavior; automatic self-cast may apply."} />
        </FlowLayout>);
        const save = () => {
            flush();
            try {
                const values = bindings.map(binding => { if (binding.action === undefined) throw "Choose an action for every binding."; return { key: binding.key, ...binding.action, targeting: binding.targeting, traits: { ...binding.traits, onlyTarget: binding.targeting === "mouseover" } }; });
                const saved = editing === undefined ? core.ClickCastPresets.Create(name, values)
                    : (core.ClickCastPresets.Update(editing, name, values), core.ClickCastPresets.Get(editing)!);
                load(saved); message = "Preset saved. All attached buttons use these bindings.";
            } catch (failure) { message = String(failure); }
            refresh();
        };
        return <FlowLayout width={context.width} height={context.height} padding={10} gap={8} onMount={host => { pageHost = host; return () => { if (pageHost === host) { pageHost = undefined; picker.Close(); } }; }}>
            <Label height={28} text="Click Cast Presets" fontSize={20} color={colors.accent} />
            <Label height={36} text="Click a Binding field, then press a mouse button with optional Shift, Ctrl or Alt. Escape cancels; Delete clears. Choose Direct secure action or Mouseover macro for each binding. Named macros keep their own targeting." fontSize={11} color={colors.muted} />
            <FlowLayout width={width} height={50} padding={6} gap={3} decorations={{ background: new Background({ color: colors.background }) }}>
                <Label height={18} text="Standard · built in and locked" fontSize={12} color={colors.accent} />
                <Label height={20} text="Left click: select unit | Right click: context menu. A named preset overrides only its mapped combinations." fontSize={10} />
            </FlowLayout>
            <FlowLayout width={width} height={workspaceHeight} direction="horizontal" gap={8}>
                <FlowLayout width={libraryWidth} height={workspaceHeight} padding={8} gap={6} decorations={{ background: new Background({ color: colors.surface }) }}>
                    <Label height={20} text="Named presets" fontSize={12} color={colors.accent} />
                    {viewport(libraryWidth - 16, workspaceHeight - 68, rows.length === 0
                        ? <Label width={listWidth} height={36} text="No named presets yet." fontSize={10} />
                        : <FlowLayout width={listWidth} height={rows.length * 80 - 4} gap={4}>{rows}</FlowLayout>, false)}
                    <FlowLayout height={20} direction="horizontal" gap={4}>
                        <Label width={libraryWidth - 72} text={named.length + " presets"} fontSize={10} />
                        <Button width={24} height={20} onClick={() => listScroll?.ScrollBy(-80)}><Label text="^" align="CENTER" fontSize={11} /></Button>
                        <Button width={24} height={20} onClick={() => listScroll?.ScrollBy(80)}><Label text="v" align="CENTER" fontSize={11} /></Button>
                    </FlowLayout>
                </FlowLayout>
                <FlowLayout width={formWidth} height={workspaceHeight} padding={8} gap={6} decorations={{ background: new Background({ color: colors.surface }) }}>
                    <Label height={20} text={editing === undefined ? "New named preset" : "Edit preset"} fontSize={12} color={colors.accent} />
                    {field("name", "Name", formInner, name, value => { name = value; }, 96)}
                    {viewport(formInner, bindingsHeight, bindingRows.length === 0
                        ? <Label width={bindingsWidth} height={32} text="Add a binding to begin." fontSize={10} />
                        : <FlowLayout width={bindingsWidth} height={bindingRows.length * 144 - 4} gap={4}>{bindingRows}</FlowLayout>, true)}
                    <FlowLayout height={26} direction="horizontal" gap={6}>
                        {control("Add binding", () => {
                            flush();
                            if (bindings.length >= 40) message = "All forty mouse/modifier combinations are already listed.";
                            else { bindings.push(newRow("")); bindingOffset = bindings.length * 144; message = ""; }
                            refresh();
                        }, (formInner - 12) / 3)}
                        {control("Save preset", save, (formInner - 12) / 3)}
                        {control("New", () => { load(); message = ""; refresh(); }, (formInner - 12) / 3)}
                    </FlowLayout>
                    {message === "" ? [] : <Label height={32} text={message} fontSize={10} color={colors.accent} />}
                </FlowLayout>
            </FlowLayout>
        </FlowLayout>;
    } });
}
