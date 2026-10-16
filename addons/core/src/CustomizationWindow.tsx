import { UI, wuira } from "wuira";
import { Window, FlowLayout, Cell, Button, Label, Background, Border } from "wuira/ui";
import type { CustomizationPage, CustomizationContext, EditMode } from "./core/contract";
import { darkTheme } from "./theme/dark";
import { ControlContent, Glyph } from "./theme/ControlContent";

interface Actions { SetMode(mode: EditMode): void; Reset(): void; }

/** Standalone navigation host. Feature addons register their own page renderers. */
export class CustomizationWindow {
    private readonly pages = new Map<string, CustomizationPage>();
    private selected = "dashboard";
    private returnPage = "dashboard";
    private window?: Window;
    private pageMount?: { host: wuiraNativeFrame; content?: wuiraNativeFrame; refresh(): void };

    public constructor(private readonly actions: Actions) {}

    public RegisterPage(page: CustomizationPage): () => void {
        if (page.id === "dashboard" || this.pages.has(page.id)) throw "LumaUI: customization page already registered: " + page.id;
        this.pages.set(page.id, page);
        if (this.window?.IsOpen) this.Open();
        return () => {
            if (this.pages.get(page.id) !== page) return;
            this.pages.delete(page.id);
            if (this.selected === page.id) this.selected = "dashboard";
            if (this.window?.IsOpen) this.Open();
        };
    }

    public Open(id?: string): void {
        if (id !== undefined) {
            if (id !== "dashboard" && !this.pages.has(id)) {
                console.log("LumaUI: enable the addon that provides the " + id + " page.");
                return;
            }
            if (this.pages.get(id)?.workspace && !this.pages.get(this.selected)?.workspace) this.returnPage = this.selected;
            this.selected = id;
        }
        if (this.window === undefined) this.window = new Window({
            width: Math.min(1160, Math.max(640, UIParent.GetWidth() - 40)),
            height: Math.min(720, Math.max(480, UIParent.GetHeight() - 80)),
        });
        this.window.Open(() => this.View());
    }

    public Close(): void { this.window?.Close(); }
    public Refresh(): void {
        const page = this.pageMount;
        if (!this.window?.IsOpen || page === undefined) return;
        // Finish the native click callback before replacing the clicked controls.
        page.host.SetScript("OnUpdate", () => {
            page.host.SetScript("OnUpdate", undefined);
            if (this.window?.IsOpen && this.pageMount === page) page.refresh();
        });
    }

    private Navigate(id: string): void { this.Open(id); }

    private Nav({ id, title }: { id: string; title: string }) {
        const selected = this.selected === id;
        return <Button height={40} onClick={() => this.Navigate(id)}
            decorations={{ background: new Background({ color: selected ? darkTheme.colors.border : darkTheme.colors.surface }) }}>
            <ControlContent text={title} icon={id === "dashboard" ? "settings" : id === "library" ? "component" : id === "builtin-presets" ? "import" : id === "click-cast" ? "button" : "design"} width={184} height={40} size={12} color={selected ? darkTheme.colors.accent : darkTheme.colors.text} />
        </Button>;
    }

    private Dashboard(context: CustomizationContext) {
        return <FlowLayout width={context.width} height={context.height} gap={12}>
            <Label height={32} text="Make LumaUI yours" fontSize={24} color={darkTheme.colors.text} />
            <Label height={34} text="Arrange your interface, configure modules, and build reusable layouts." fontSize={12} color={darkTheme.colors.muted} />
            <FlowLayout height={36} direction="horizontal" gap={12}>
                <Button width={180} onClick={() => this.actions.SetMode("unlock")}
                    decorations={{ background: new Background({ color: darkTheme.colors.border }) }}>
                    <ControlContent text="Unlock layout" icon="layout" width={180} height={36} size={12} />
                </Button>
                <Button width={180} onClick={() => this.actions.SetMode("keys")}
                    decorations={{ background: new Background({ color: darkTheme.colors.border }) }}>
                    <ControlContent text="Keybind mode" icon="button" width={180} height={36} size={12} />
                </Button>
            </FlowLayout>
            <Label height={28} text="YOUR MODULES" fontSize={11} color={darkTheme.colors.accent} />
            {Array.from(this.pages.values()).map(page =>
                <Button height={68} onClick={() => this.Navigate(page.id)}
                    decorations={{ background: new Background({ color: darkTheme.colors.surface }),
                        border: new Border({ thickness: 1, color: darkTheme.colors.border }) }}>
                    <FlowLayout padding={12} gap={6}>
                        <Label height={18} text={page.title} fontSize={14} />
                        <Label height={16} text={page.summary ?? ""} fontSize={11} color={darkTheme.colors.muted} />
                    </FlowLayout>
                </Button>)}
            <Label height={32} condition={this.pages.size === 0}
                text="Enable a LumaUI feature addon to add its customization page." fontSize={12} color={darkTheme.colors.muted} />
        </FlowLayout>;
    }

    private View() {
        const window = this.window!;
        const width = window.Frame.GetWidth();
        const height = window.Frame.GetHeight();
        const bodyHeight = height - 132;
        const workspace = this.pages.get(this.selected)?.workspace === true;
        const context = { width: width - (workspace ? 64 : 288), height: bodyHeight - 32 };

        return <FlowLayout width="inherit" height="inherit" padding={16} gap={12} clickThrough={false}
            decorations={{ background: new Background({ color: darkTheme.colors.background }),
                border: new Border({ thickness: 1, color: darkTheme.colors.border }) }}>
            <FlowLayout height={48} direction="horizontal" gap={12} onMount={frame => window.BindDragHandle(frame)}>
                {workspace ? <Button width={96} height={32} margin={{ top: 8 }} onClick={() => this.Open(this.pages.has(this.returnPage) ? this.returnPage : "dashboard")}
                    decorations={{ background: new Background({ color: darkTheme.colors.surface }) }}><ControlContent text="Back" icon="back" width={96} height={32} size={12} /></Button> : []}
                <Label width={width - (workspace ? 188 : 80)} text={workspace ? "LumaUI / Editor" : "LumaUI"} fontSize={24} color={darkTheme.colors.accent} />
                <Button width={36} height={32} margin={{ top: 8 }} onClick={() => this.Close()}
                    decorations={{ background: new Background({ color: darkTheme.colors.surface }) }}>
                    <Cell width={36} height={32} padding={{ left: 10, top: 8 }}><Glyph icon="close" size={16} /></Cell>
                </Button>
            </FlowLayout>
            <FlowLayout height={bodyHeight} direction="horizontal" gap={16}>
                {workspace ? [] : <FlowLayout width={208} padding={12} gap={8}
                    decorations={{ background: new Background({ color: darkTheme.colors.surface }) }}>
                    <Label height={24} text="CUSTOMIZE" fontSize={10} color={darkTheme.colors.muted} />
                    {this.Nav({ id: "dashboard", title: "Dashboard" })}
                    {Array.from(this.pages.values()).map(page => this.Nav({ id: page.id, title: page.title }))}
                </FlowLayout>}
                <Cell width={width - (workspace ? 32 : 256)} padding={16} onMount={host => {
                    host.SetClipsChildren(true);
                    const state: NonNullable<CustomizationWindow["pageMount"]> = { host, refresh: () => {
                        try {
                            const page = this.pages.get(this.selected);
                            const view = page === undefined ? this.Dashboard(context) : page.Render(context);
                            const next = wuira.Mount(view ?? (() => {}), undefined, host);
                            if (next !== undefined) {
                                next.ClearAllPoints();
                                next.SetPoint("TOPLEFT", host, "TOPLEFT", 16, -16);
                            }
                            const previous = state.content;
                            state.content = next;
                            if (previous !== undefined) wuira.Unmount(previous);
                        } catch (failure) { console.log("LumaUI: customization update failed: " + String(failure)); }
                    } };
                    this.pageMount = state;
                    state.refresh();
                    return () => {
                        host.SetScript("OnUpdate", undefined);
                        if (state.content !== undefined) wuira.Unmount(state.content);
                        if (this.pageMount === state) this.pageMount = undefined;
                    };
                }}
                    decorations={{ background: new Background({ color: { r: 0.025, g: 0.032, b: 0.048, a: 1 } }) }}
                />
            </FlowLayout>
            <Label height={28} text="LumaUI  /  Character settings  /  Escape to close" fontSize={11} color={darkTheme.colors.muted} />
        </FlowLayout>;
    }
}
