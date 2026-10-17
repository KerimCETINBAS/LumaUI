import { UI } from "wuira";
import { Core } from "./core";
import { EditorDraft } from "./Draft";
import { EditorView } from "./EditorView";

Core.Store.onReady(() => {

    const draft = new EditorDraft();

    Core.RegisterPresetEditor(document => draft.Load(document));
    Core.RegisterPresetCreator(() => draft.New());

    Core.RegisterPage({
        id: "editor",
        title: "Visual Editor",
        workspace: true,
        Suspend: () => draft.Suspend(),
        summary: "Build layouts with a component tree and live preview.",
        Render: context =>
            <EditorView
                draft={draft}
                width={context.width}
                height={context.height} />
    });
});
