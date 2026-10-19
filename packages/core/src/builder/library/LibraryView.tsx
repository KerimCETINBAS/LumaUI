import { ComponentThumbnail } from "./ComponentPreview";
import { UI } from "wuira/ui";
import { wuira } from "wuira";
import { FlowLayout, GridLayout, Cell, ScrollHost, Label, Button, Background, Border } from "wuira/ui";
import type { LumaCoreAPI, BuilderDocument } from "../../core/contract";
import { BuilderSettings } from "./Library";
import { ControlContent, controlIcon } from "../../theme/ControlContent";

export function installLibrary(core: LumaCoreAPI): void {
    let kind: "preset" | "skin" = "preset";
    let message = "";
    let scroll: ScrollHost | undefined;
    const offsets = { preset: 0, skin: 0 };
    const colors = core.Theme.colors;
    const refresh = () => core.RefreshCustomization();
    const run = (action: () => void) => { try { action(); message = "Updated."; } catch (failure) { message = String(failure); } refresh(); };
    const control = (text: string, action: () => void, width: number) => <Button width={width} height={24} onClick={action}
        onMount={frame => { frame.SetFrameLevel(frame.GetFrameLevel() + 30); }}
        decorations={{ background: new Background({ color: colors.border }) }}><ControlContent text={text} icon={controlIcon(text)} width={width} /></Button>;
    const activate = (document: BuilderDocument) => run(() => {
        if (document.kind === "preset") core.Presets.SetActivation(document.id, document.enabled === "always" ? "always" : "condMet");
        else { core.Skins.Apply(document); core.Skins.Save(document, true); }
    });
    const disable = (document: BuilderDocument) => run(() => {
        if (document.kind === "preset") { core.Presets.Unmount(document.id); core.Presets.Save(document, false); }
        else { core.Skins.Remove(document.id); core.Skins.Save(document, false); }
    });
    const summary = (document: BuilderDocument): string => {
        if (document.kind !== "preset") return "Native skin";
        let type = "Component"; try { type = core.Presets.IsHeadless(document) ? "Headless" : "Visual"; } catch { type = "Unavailable component or dependency"; }
        const users = core.Presets.UsedBy(document.id);
        return type + (users.length > 0 ? " | Used by: " + users.map(parent => parent.name).join(", ") : "");
    };
    const tab = (type: "preset" | "skin", text: string, width: number) => <Button width={width} height={34}
        onClick={() => { if (kind !== type) { kind = type; message = ""; refresh(); } }}
        decorations={{ background: new Background({ color: kind === type ? colors.surface : colors.background }) }}>
        <Label text={text} align="CENTER" fontSize={11} color={kind === type ? colors.accent : colors.muted} />
    </Button>;

    core.RegisterPage({ id: "library", title: "UI Library", summary: "Import components or customize Blizzard frames with skins.", Render: context => {
        const shownKind = kind;
        const documents: BuilderDocument[] = shownKind === "preset" ? core.Presets.List() : core.Skins.List();
        const enabled = core.Store.get(BuilderSettings).enabled;
        const importWidth = Math.min(146, context.width * .36);
        const firstTabWidth = Math.min(120, (context.width - importWidth) / 2);
        const newWidth = shownKind === "preset" ? 80 : 0;
        const secondTabWidth = Math.min(144, context.width - importWidth - newWidth - firstTabWidth);
        const innerWidth = context.width - 20;
        const gridWidth = innerWidth - 8;
        const cardWidth = (gridWidth - 10) / 2;
        const actionColumns = cardWidth >= 300 ? 4 : 2;
        const actionHeight = actionColumns === 4 ? 24 : 52;
        const thumbnailHeight = 76;
        const cardHeight = 68 + actionHeight + thumbnailHeight + 4;
        const viewportHeight = Math.max(40, context.height - 82 - (message === "" ? 0 : 30));
        const contentHeight = Math.max(32, Math.ceil(documents.length / 2) * (cardHeight + 8) - 8);
        const cards = documents.map(document => {
            // Eligibility may be waiting even while enabled; the toggle follows manual state.
            const isEnabled = enabled.includes(document.kind + ":" + document.id) && (document.kind !== "preset" || document.enabled !== "never");
            const status = document.kind === "preset" ? core.Presets.ActivationStatus(document.id) : isEnabled ? "Enabled" : "Disabled";
            const actionWidth = (cardWidth - 16 - (actionColumns - 1) * 4) / actionColumns;
            const actions = [
                control(isEnabled ? "Disable" : "Enable", () => isEnabled ? disable(document) : activate(document), actionWidth),
                ...(document.kind === "preset" ? [control("Edit", () => { try { core.EditPreset(document); message = ""; } catch (failure) { message = String(failure); refresh(); } }, actionWidth)] : []),
                control("Export", () => run(() => core.OpenExport(document)), actionWidth),
                control("Delete", () => run(() => { if (document.kind === "preset") core.Presets.Delete(document.id); else core.Skins.Delete(document.id); }), actionWidth),
            ];
            return <FlowLayout width={cardWidth} height={cardHeight} gap={4} padding={8}
                decorations={{ background: new Background({ color: colors.background }) }}>
                <Label height={18} text={document.name} fontSize={12} />
                <Label height={26} fontSize={10} color={colors.muted} text={status + " | " + summary(document)} />
                {ComponentThumbnail(document, cardWidth - 16, thumbnailHeight, core.Presets, core.Theme)}
                <GridLayout width={cardWidth - 16} height={actionHeight} columns={actionColumns} cellWidth={actionWidth} cellHeight={24} rowGap={4} columnGap={4}>
                    {actions}
                </GridLayout>
            </FlowLayout>;
        });
        return <FlowLayout width={context.width} height={context.height} gap={0}>
            <FlowLayout height={34} direction="horizontal" gap={0}>
                {tab("preset", "Components", firstTabWidth)}
                {tab("skin", "Blizzard Skins", secondTabWidth)}
                <Cell width={Math.max(0, context.width - firstTabWidth - secondTabWidth - importWidth - newWidth)} height={34} />
                {shownKind === "preset" ? <Button width={newWidth} height={28} margin={{ top: 3, bottom: 3 }} onClick={() => core.CreatePreset()}
                    decorations={{ background: new Background({ color: colors.border }) }}>
                    <ControlContent text="New" icon="plus" width={newWidth} height={28} />
                </Button> : []}
                <Button width={importWidth} height={28} margin={{ top: 3, bottom: 3 }} onClick={() => core.OpenImport(shownKind)}
                    decorations={{ background: new Background({ color: colors.border }), border: new Border({ color: colors.accent, thickness: 1 }) }}>
                    <ControlContent text={shownKind === "preset" ? "Import component" : "Import skin"} icon="import" width={importWidth} height={28} />
                </Button>
            </FlowLayout>
            <FlowLayout width={context.width} height={context.height - 34} padding={10} gap={8}
                decorations={{ background: new Background({ color: colors.surface }) }}>
                {message === "" ? [] : <Label height={22} text={message} fontSize={11} color={colors.accent} />}
                <Cell width={innerWidth} height={viewportHeight} clickThrough onMount={host => {
                    const viewport = new ScrollHost(host, offset => { offsets[shownKind] = offset; }); scroll = viewport;
                    let content: wuiraNativeFrame | undefined;
                    try {
                        const view = documents.length === 0
                            ? <Label width={gridWidth} height={32} text="Import a component, or create one with LumaUI.Editor." fontSize={11} />
                            : <GridLayout width={gridWidth} height={contentHeight} columns={2} cellWidth={cardWidth} cellHeight={cardHeight} columnGap={10} rowGap={8}>{cards}</GridLayout>;
                        content = wuira.Mount(view, undefined, viewport.Frame);
                        viewport.SetContent(content!, offsets[shownKind]);
                    } catch (failure) { if (content !== undefined) wuira.Unmount(content); viewport.Dispose(); if (scroll === viewport) scroll = undefined; throw failure; }
                    return () => { if (content !== undefined) wuira.Unmount(content); viewport.Dispose(); if (scroll === viewport) scroll = undefined; };
                }} />
                <FlowLayout height={20} direction="horizontal" gap={8}>
                    <Label width={innerWidth} height={20} fontSize={10} color={colors.muted}
                        text={documents.length + (shownKind === "preset" ? " components" : " skins") + " | Scroll to browse"} />
                </FlowLayout>
            </FlowLayout>
        </FlowLayout>;
    } });
}
