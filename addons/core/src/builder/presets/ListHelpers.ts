import type { ListHelperDefinition, SourceSpec } from "../../core/builder";
import { fail, identifier, text } from "../validate";
/** Allowlisted compiled factories. Expressions are parsed as data, never evaluated. */
export class ListHelpers {
    private readonly factories = new Map<string, ListHelperDefinition>();
    public Register(name: string, definition: ListHelperDefinition): () => void {
        identifier(name); if (this.factories.has(name)) fail("list helper already registered: " + name);
        this.factories.set(name, definition);
        return () => { if (this.factories.get(name) === definition) this.factories.delete(name); };
    }
    public Names(): string[] { return Array.from(this.factories.keys()); }
    public Parse(expression: string): SourceSpec {
        const value = text(expression, "items expression", 4096).trim();
        const open = value.indexOf("(");
        if (open < 1 || !value.endsWith(")")) fail('expected a list helper such as KnownSpells("Seal*")');
        const name = identifier(value.slice(0, open).trim());
        const definition = this.factories.get(name); if (definition === undefined) fail("unknown list helper: " + name);
        return { name: "inline-items", type: definition.source, props: definition.Parse(value.slice(open + 1, -1)) };
    }
}
