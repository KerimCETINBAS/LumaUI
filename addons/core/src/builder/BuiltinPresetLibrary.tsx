import { UI, wuira } from "wuira";
import { FlowLayout, Label, Button, Background, ScrollHost, Cell } from "wuira/ui";
import type { BuiltinPresetDefinition, LumaCoreAPI } from "../core/contract";
import { BuiltinPresets, BuiltinPresetEntries } from "../BuiltinPresets";
import { identifier, keys, record, text, fail } from "./validate";

type Description = { key: string; name: string; kind: "preset" | "skin" };
/** The catalog owns strings and labels only. Import uses the normal confirmation dialog. */
export class BuiltinPresetLibrary {
    private readonly entries = new Map<string, Description>();
    public constructor(core: LumaCoreAPI, private readonly strings: Record<string, string>) {
        for (const entry of BuiltinPresetEntries) this.Register({ ...entry, importString: BuiltinPresets[entry.key] });
        core.RegisterPage({ id: "builtin-presets", title: "Built-in presets", sidebar: false, summary: "Optional presets you can import manually.", Render: context => {
            const colors = core.Theme.colors;
            return <FlowLayout width={context.width} height={context.height} padding={10} gap={8}>
                <Label height={28} text="Built-in presets" fontSize={20} color={colors.accent} />
                <Label height={44} text="Choose a preset to open its import string. Nothing is installed until you confirm Import. Existing components are kept." fontSize={11} />
                <Cell width={context.width - 20} height={Math.max(40, context.height - 110)} onMount={host => {
                    const scroll = new ScrollHost(host);
                    const entries = Array.from(this.entries.values());
                    const view = wuira.Mount(<FlowLayout width={host.GetWidth() - 12} height={Math.max(32, entries.length * 42)} gap={8}>
                        {entries.map(entry => <Button height={34} onClick={() => core.OpenImport(entry.kind, undefined, this.strings[entry.key])}
                            decorations={{ background: new Background({ color: colors.border }) }}><Label text={"Import · " + entry.name} fontSize={11} align="CENTER" /></Button>)}
                    </FlowLayout>, undefined, scroll.Frame);
                    scroll.SetContent(view!); return () => { if (view !== undefined) wuira.Unmount(view); scroll.Dispose(); };
                }} />
            </FlowLayout>;
        } });
    }
    public Register(input: BuiltinPresetDefinition): () => void {
        const entry = record(input); keys(entry, ["key", "name", "kind", "importString"]);
        const key = identifier(entry.key), name = text(entry.name, "built-in preset name", 96);
        if (["constructor", "prototype", "__proto__"].includes(key)) fail("reserved built-in preset key");
        if (issecretvalue(entry.kind) || entry.kind !== "preset" && entry.kind !== "skin") fail("invalid built-in preset kind");
        const value = text(entry.importString, "built-in import string", 262144).trim();
        if (!["!LUMA:1!", "!LUMA:2!", "!LUMA:3!"].some(prefix => value.startsWith(prefix))) fail("unsupported built-in import format");
        if (this.entries.has(key)) fail("built-in preset already registered: " + key);
        const description: Description = { key, name, kind: entry.kind };
        this.entries.set(key, description); this.strings[key] = value;
        return () => { if (this.entries.get(key) === description) { this.entries.delete(key); delete this.strings[key]; } };
    }
}
