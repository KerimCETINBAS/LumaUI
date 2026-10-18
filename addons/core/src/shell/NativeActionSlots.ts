import { ActionBars } from "wuira/platform";
import { wuira } from "wuira";
import type { ActionSlot } from "wuira/platform";
import { Store, StoreRegistry } from "wuira/store";

/** Retain the existing character backup format after retiring the ActionBars addon. */
class NativeSlotBackup extends Store {
    public static readonly Token = "wuira.native-action-bars";
    public phase: "capture" | "ready" | "disabled" | "restore" | "restored" = "capture";
    public slots: ActionSlot[] = [];
}

/** Slot data changes only through explicit commands; components own bar visibility. */
export function installActionSlotCommands(): () => void {
    let store: StoreRegistry | undefined;
    let capturedThisSession = false, disposed = false;
    const run = (restore: boolean) => {
        if (disposed) return;
        if (InCombatLockdown()) { console.warn("Change native action slots after combat ends."); return; }
        store ??= new StoreRegistry({ addon: "LumaUI", variable: "LumaUIActionBarBackup" });
        if (!store.IsReady) { console.warn("Native action slot settings are not ready yet."); return; }
        try {
            const settings = store.get(NativeSlotBackup);
            if (settings.phase === "capture") {
                if (restore) { console.warn("No saved native action slot backup is available."); return; }
                const slots = ActionBars.Capture();
                store.set(NativeSlotBackup, value => { value.slots = slots; value.phase = "ready"; return value; });
                capturedThisSession = true;
                console.log("Native action slots backed up. Use /reload before /lumaclearbars to persist the backup.");
                return;
            }
            if (capturedThisSession) { console.warn("Use /reload to persist the native action slot backup first."); return; }
            if (restore) ActionBars.Restore(settings.slots); else ActionBars.Clear(settings.slots);
            store.set(NativeSlotBackup, value => { value.phase = restore ? "restored" : "disabled"; return value; });
            console.log(restore ? "Native action slots restored. Disable their hiding component to show native bars." : "Native action slots cleared.");
        } catch (failure) { console.error("Native action slots:", failure); }
    };
    const clear = wuira.registerCommand("/lumaclearbars", () => run(false));
    const restore = wuira.registerCommand("/lumarestorebars", () => run(true));
    return () => {
        if (disposed) return;
        disposed = true; clear(); restore(); store?.Dispose();
    };
}
