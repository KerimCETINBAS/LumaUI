import type { ForEachSource } from "wuira/ui";
/** Keep iterable array slots separate from wuira's observable-list protocol. */
export class ObservableItems implements ForEachSource<object> {
    public constructor(private readonly source: ForEachSource<object>) {}
    public get Value(): readonly object[] { return this.source.Value; }
    public onChange(listener: (items: readonly object[]) => void): () => void { return this.source.onChange(listener); }
}
