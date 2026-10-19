import { autocompletion } from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { xml } from "@codemirror/lang-xml";
import { bracketMatching, defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { createEffect, onCleanup, onMount, Show } from "solid-js";
import { markupSchema } from "./markup";

export function SourceView(props: { value: string; problem: string; onChange: (value: string) => void }) {
  let host: HTMLDivElement | undefined;
  let view: EditorView | undefined;

  onMount(() => {
    view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: props.value,
        extensions: [
          lineNumbers(),
          history(),
          indentOnInput(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          xml({ elements: markupSchema() }),
          autocompletion(),
          EditorView.lineWrapping,
          EditorView.updateListener.of(update => {
            if (update.docChanged) props.onChange(update.state.doc.toString());
          }),
          EditorView.theme({
            "&": { height: "100%", backgroundColor: "rgb(9, 11, 17)", color: "rgb(199, 212, 230)" },
            ".cm-scroller": { fontFamily: "ui-monospace, Cascadia Code, monospace", fontSize: "13px", lineHeight: "1.5" },
            ".cm-gutters": { backgroundColor: "rgb(9, 11, 17)", color: "rgb(89, 97, 112)", border: "none" },
            ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "rgb(20, 26, 36)" },
            "&.cm-focused": { outline: "none" },
            ".cm-tooltip-autocomplete": { backgroundColor: "rgb(20, 26, 36)", border: "1px solid rgb(56, 71, 92)" },
            ".cm-tooltip-autocomplete ul li[aria-selected]": { background: "rgb(9, 11, 17)", color: "rgb(102, 191, 255)" },
          }),
        ],
      }),
    });
  });

  createEffect(() => {
    const next = props.value;
    if (view === undefined || view.state.doc.toString() === next) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
  });

  onCleanup(() => view?.destroy());

  return (
    <div class="source-body">
      <div class="source-editor" ref={host} />
      <Show when={props.problem.length > 0}>
        <p class="source-problem">{props.problem}</p>
      </Show>
    </div>
  );
}
