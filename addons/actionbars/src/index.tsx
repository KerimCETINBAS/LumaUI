import { ActionBars } from "wuira";
import { Core } from "./core";
import { ActionBarOptions } from "./Options";
import { Hotbar } from "./Hotbar";

Core.Store.onReady(() => {
    const options = new ActionBarOptions();
    options.Install();
    const hotbar = new Hotbar();
    options.onReset = () => hotbar.Reset();
    // The master retains ownership of the existing character backup variable.
    ActionBars.InstallEmptyMode({
        addon: "LumaUI", variable: "LumaUIActionBarBackup",
        clearCommand: "/lumaclearbars", restoreCommand: "/lumarestorebars",
    });
});
console.log("LumaUI ActionBars loaded");
