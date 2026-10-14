import { UI } from "wuira";
import { FlowLayout, Label, Button, Background } from "wuira/ui";
import type { LumaCoreAPI, BuilderDocument } from "../core/contract";
import { BuilderSettings } from "./Library";
export function installLibrary(core: LumaCoreAPI): void {
    let kind: "preset" | "skin" = "preset";
    let page = 0;
    let message = "Presets create new UI. Skins customize registered Blizzard frames.";
    const refresh = () => core.RefreshCustomization();
    const run = (action: () => void) => { try { action(); message = "Updated."; } catch (failure) { message = String(failure); } refresh(); };
    const control = (text: string, action: () => void, width = 110) => <Button width={width} height={28} onClick={action}
        decorations={{ background: new Background({ color: core.Theme.colors.border }) }}><Label text={text} align="CENTER" fontSize={11} /></Button>;
    const activate = (document: BuilderDocument) => run(() => {
        if (document.kind === "preset") { core.Presets.Mount(document); core.Presets.Save(document, true); }
        else { core.Skins.Apply(document); core.Skins.Save(document, true); }
    });
    const disable = (document: BuilderDocument) => run(() => {
        if (document.kind === "preset") { core.Presets.Unmount(document.id); core.Presets.Save(document, false); }
        else { core.Skins.Remove(document.id); core.Skins.Save(document, false); }
    });
    const summary = (document: BuilderDocument): string => {
        if (document.kind !== "preset") return "Native skin";
        let type = "Preset"; try { type = core.Presets.IsHeadless(document) ? "Headless" : "Visual"; } catch { type = "Unavailable component or dependency"; }
        const users = core.Presets.UsedBy(document.id);
        return type + (users.length > 0 ? " | Used by: " + users.map(parent => parent.name).join(", ") : "");
    };
    core.RegisterPage({ id: "library", title: "UI Library", summary: "Import presets or customize Blizzard frames with skins.", Render: context => {
        const documents: BuilderDocument[] = kind === "preset" ? core.Presets.List() : core.Skins.List();
        const enabled = core.Store.get(BuilderSettings).enabled;
        page = Math.min(page, Math.max(0, Math.ceil(documents.length / 4) - 1));
        return <FlowLayout width={context.width} height={context.height} gap={12}>
            <Label height={30} text="UI Collections" fontSize={22} />
            <Label height={32} text={message} fontSize={11} color={core.Theme.colors.muted} />
            <FlowLayout height={28} direction="horizontal" gap={8}>
                {control("Presets", () => { kind = "preset"; page = 0; refresh(); })}
                {control("Blizzard Skins", () => { kind = "skin"; page = 0; refresh(); }, 130)}
                {control("Import " + kind, () => core.OpenImport(kind), 130)}
            </FlowLayout>
            <Label height={24} text={kind === "preset" ? "NEW INTERFACE TREES" : "EXISTING BLIZZARD FRAMES"} fontSize={11} color={core.Theme.colors.accent} />
            {documents.slice(page * 4, page * 4 + 4).map(document => <FlowLayout height={94} gap={6} padding={8}
                decorations={{ background: new Background({ color: core.Theme.colors.surface }) }}>
                <Label height={18} text={document.name + (enabled.includes(kind + ":" + document.id) ? "  (enabled)" : "  (disabled)")} fontSize={12} />
                <Label height={20} fontSize={10} color={core.Theme.colors.muted} text={summary(document)} />
                <FlowLayout height={28} direction="horizontal" gap={6}>
                    {control("Apply", () => activate(document), 80)}
                    {control("Disable", () => disable(document), 80)}
                    {document.kind === "preset" ? control("Edit", () => core.EditPreset(document), 80) : <></>}
                    {control("Export", () => run(() => core.OpenExport(document)), 80)}
                    {control("Delete", () => run(() => { if (document.kind === "preset") core.Presets.Delete(document.id); else core.Skins.Delete(document.id); }), 80)}
                </FlowLayout>
            </FlowLayout>)}
            <Label height={32} condition={documents.length === 0} text="Import a document, or create a preset with LumaUI.Editor." fontSize={12} />
            <FlowLayout height={28} direction="horizontal" gap={8}>
                {control("<", () => { page = Math.max(0, page - 1); refresh(); }, 40)}
                <Label width={90} text={String(page + 1) + " / " + Math.max(1, Math.ceil(documents.length / 4))} align="CENTER" />
                {control(">", () => { page = Math.min(Math.max(0, Math.ceil(documents.length / 4) - 1), page + 1); refresh(); }, 40)}
            </FlowLayout>
        </FlowLayout>;
    } });
}
