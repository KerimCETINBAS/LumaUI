/** History contains detached data, never native frames or subscriptions. */
export function cloneData<T>(value: T): T {
    if (Array.isArray(value)) return value.map(item => cloneData(item)) as T;
    if (typeof value !== "object" || value === null) return value;
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) output[key] = cloneData(child);
    return output as T;
}
export function equalData(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== "object" || a === null || typeof b !== "object" || b === null || Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => equalData(item, b[index]));
    const left = Object.keys(a), right = Object.keys(b);
    return left.length === right.length && left.every(key => equalData((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
export class EditHistory<T> {
    private past: T[] = []; private future: T[] = []; private current?: T;
    public constructor(private readonly same: (a: T, b: T) => boolean, private readonly limit = 60) {}
    public Reset(value: T): void { this.past = []; this.future = []; this.current = cloneData(value); }
    public Record(value: T): void {
        if (this.current !== undefined && this.same(this.current, value)) return;
        if (this.current !== undefined) { this.past.push(this.current); if (this.past.length > this.limit) this.past.shift(); }
        this.current = cloneData(value); this.future = [];
    }
    public get CanUndo(): boolean { return this.past.length > 0; }
    public get CanRedo(): boolean { return this.future.length > 0; }
    public Undo(): T | undefined {
        if (this.past.length === 0) return undefined;
        this.future.push(this.current!); this.current = this.past.pop()!; return cloneData(this.current);
    }
    public Redo(): T | undefined {
        if (this.future.length === 0) return undefined;
        this.past.push(this.current!); this.current = this.future.pop()!; return cloneData(this.current);
    }
}
