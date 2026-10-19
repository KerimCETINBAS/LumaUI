import { Show } from "solid-js";
import { A, useParams } from "@solidjs/router";
import { Frame } from "../shell/Frame";
import { EditorPage } from "./EditorPage";
import { findRegion, profiles, resolveRegion, updateRegion, type SampleNode } from "../library";

export function RegionPage() {
  const params = useParams<{ id: string }>();

  return (
    <Frame>
      <Show when={findRegion(params.id) === undefined ? undefined : params.id} keyed fallback={<main class="page"><h1>Missing region</h1><A class="button" href="/">Back to profiles</A></main>}>
        {id => {
          const region = findRegion(id)!;
          const owner = profiles().find(profile => profile.regionIds.includes(id) || profile.regionRefs.some(path => resolveRegion(path, profile.id)?.id === id));
          return (
            <EditorPage
              title={region.name}
              role="Region"
              blurb="Children stay where they are anchored. A part path is Part, Region.Part, or Profile.Region.Part."
              usedBy={owner === undefined ? [] : [owner.name]}
              nodes={region.nodes}
              profileId={owner?.id}
              onCommit={(nodes: SampleNode[]) => updateRegion(id, { nodes, name: nodes[0]?.name || region.name })}
            />
          );
        }}
      </Show>
    </Frame>
  );
}
