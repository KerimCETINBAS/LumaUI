import { Show } from "solid-js";
import { A, useParams } from "@solidjs/router";
import { Frame } from "../shell/Frame";
import { EditorPage } from "./EditorPage";
import { findPart, modulesUsing, updatePart, type SampleNode } from "../library";

export function PartPage() {
  const params = useParams<{ id: string }>();

  return (
    <Frame>
      <Show when={findPart(params.id) === undefined ? undefined : params.id} keyed fallback={<main class="page"><h1>Missing part</h1><A class="button" href="/parts">Back to parts</A></main>}>
        {id => {
          const part = findPart(id)!;
          return (
            <EditorPage
              title={part.name}
              role="Part"
              blurb={part.summary}
              usedBy={modulesUsing(id).map(module => module.name)}
              nodes={part.nodes}
              onCommit={(nodes: SampleNode[]) => updatePart(id, { nodes, name: nodes[0]?.name || part.name })}
            />
          );
        }}
      </Show>
    </Frame>
  );
}
