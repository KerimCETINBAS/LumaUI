import { BlizzardUI } from "wuira/platform";
import type { Properties } from "../../core/builder";
/** Shared ownership prevents one preset/skin from restoring a frame another still hides. */
const hidden = new Map<string, { users: number; restore(): void }>();
export function hideNativeFrames(props: Properties): () => void {
    const releases: (() => void)[] = [];
    for (const unit of ["player", "target", "focus", "actionBars"]) if (props[unit] === true) {
        let entry = hidden.get(unit);
        if (entry === undefined) {
            entry = { users: 0, restore: BlizzardUI.Hide({ [unit]: true }) }; hidden.set(unit, entry);
        }
        entry.users++;
        const owned = entry; let released = false;
        releases.push(() => {
            if (released) return; released = true;
            if (--owned.users === 0) { hidden.delete(unit); owned.restore(); }
        });
    }
    return () => { for (const release of releases) release(); };
}
