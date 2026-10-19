import { For, Show } from "solid-js";
import { A, useNavigate, useParams } from "@solidjs/router";
import { Frame } from "../shell/Frame";
import { ReferenceControl } from "../inputs/Controls";
import { NameField } from "../inputs/Name";
import {
  attachModule,
  attachRegion,
  attachRegionRef,
  createModule,
  createRegion,
  findModule,
  findProfile,
  placedModuleIds,
  profileRegions,
  regionReferencePaths,
  updateProfile,
} from "../library";

export function ProfilePage() {
  const params = useParams<{ id: string }>();
  const navigate = useNavigate();
  const profile = () => findProfile(params.id);
  const listed = () => {
    const current = profile();
    return current === undefined ? [] : profileRegions(current);
  };
  const placed = () => new Set(listed().flatMap(row => placedModuleIds(row.region)));
  const loose = () => {
    const current = profile();
    if (current === undefined) return [];
    return current.moduleIds.flatMap(id => {
      const entry = findModule(id);
      return entry !== undefined && !placed().has(entry.id) ? [entry] : [];
    });
  };

  return (
    <Frame>
      <Show when={profile()} fallback={<main class="page"><h1>Missing profile</h1><A class="button" href="/">Back to profiles</A></main>}>
        <main class="page">
          <div class="page-head">
            <div>
              <A class="back" href="/">Profiles</A>
              <h1><NameField value={profile()!.name} onChange={name => updateProfile(profile()!.id, { name })} /></h1>
              <p class="lead">{profile()!.summary}</p>
            </div>
            <span class="chip">{profile()!.activation.length > 0 ? profile()!.activation.join(" · ") : "Not set yet"}</span>
          </div>
          <section>
            <div class="section-head">
              <h2>Regions</h2>
              <button class="button" type="button" onClick={() => {
                const region = createRegion();
                attachRegion(profile()!.id, region.id);
                navigate(`/regions/${region.id}`);
              }}>New region</button>
            </div>
            <div class="section-ref">
              <ReferenceControl paths={regionReferencePaths(profile()!.id)} placeholder="Region or Profile.Region" onPick={path => attachRegionRef(profile()!.id, path)} />
            </div>
            <Show when={listed().length > 0} fallback={<p class="empty">No regions yet. Create one, or reference Region / Profile.Region.</p>}>
              <div class="region-board">
                <For each={listed()}>{row => (
                  <A class="region-card" href={`/regions/${row.region.id}`}>
                    <strong>{row.region.name}</strong>
                    <small>{row.owned ? (row.region.nodes.filter(node => node.depth > 0).length === 0 ? "Empty" : `${row.region.nodes.filter(node => node.depth > 0).length} placed`) : row.path}</small>
                  </A>
                )}</For>
              </div>
            </Show>
          </section>
          <section>
            <div class="section-head">
              <h2>Modules and effects</h2>
              <button class="button" type="button" onClick={() => {
                const created = createModule();
                attachModule(profile()!.id, created.id);
                navigate(`/modules/${created.id}`);
              }}>New module</button>
            </div>
            <Show when={loose().length > 0} fallback={<p class="empty">Modules placed on a region stay with that region. New modules show up here until you place them.</p>}>
              <div class="card-grid">
                <For each={loose()}>{entry => (
                  <A class="card" href={`/modules/${entry.id}`}>
                    <strong>{entry.name}</strong>
                    <p>{entry.summary}</p>
                    <span class="kicker">{entry.headless ? "Effect" : "Module"}</span>
                  </A>
                )}</For>
              </div>
            </Show>
          </section>
        </main>
      </Show>
    </Frame>
  );
}
