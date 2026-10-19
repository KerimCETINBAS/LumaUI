import { Show } from "solid-js";
import { A, useParams } from "@solidjs/router";
import { Frame } from "../shell/Frame";
import { NameField } from "../inputs/Name";
import { EditorPage } from "./EditorPage";
import { findModule, findRegion, moduleHosts, placedModuleIds, profiles, updateModule, type SampleNode } from "../library";

export function ModulePage() {
  const params = useParams<{ id: string }>();

  return (
    <Frame>
      <Show when={findModule(params.id) === undefined ? undefined : params.id} keyed fallback={<main class="page"><h1>Missing module</h1><A class="button" href="/">Back to profiles</A></main>}>
        {id => {
          const item = findModule(id)!;
          const host = profiles().find(profile => profile.moduleIds.includes(id) || profile.regionIds.some(regionId => {
            const region = findRegion(regionId);
            return region !== undefined && placedModuleIds(region).includes(id);
          }));
          return (
            <Show
              when={!item.headless}
              fallback={
                <main class="page">
                  <div class="page-head">
                    <div>
                      <A class="back" href="/">Profiles</A>
                      <h1><NameField value={item.name} onChange={name => updateModule(id, { name })} /></h1>
                      <p class="lead">{item.summary}</p>
                    </div>
                    <span class="chip">Effect</span>
                  </div>
                  <p class="empty">This module is an effect. It turns something on or off and carries no hierarchy.</p>
                </main>
              }
            >
              <EditorPage
                title={item.name}
                role="Module"
                blurb={item.summary}
                usedBy={moduleHosts(id)}
              nodes={item.nodes}
              profileId={host?.id}
              onCommit={(nodes: SampleNode[]) => updateModule(id, { nodes, name: nodes[0]?.name || item.name })}
              />
            </Show>
          );
        }}
      </Show>
    </Frame>
  );
}
