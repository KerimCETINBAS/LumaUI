import { For, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { Frame } from "../shell/Frame";
import { createPart, modulesUsing, parts } from "../library";

export function PartsPage() {
  const navigate = useNavigate();
  return (
    <Frame>
      <main class="page">
        <div class="page-head">
          <div>
            <h1>Parts</h1>
            <p class="lead">A part is a saved hierarchy. It means nothing on its own until a module or a region places it.</p>
          </div>
          <button class="primary" type="button" onClick={() => navigate(`/parts/${createPart().id}`)}>New part</button>
        </div>
        <Show when={parts().length > 0} fallback={<p class="empty">No parts yet.</p>}>
          <div class="card-grid">
            <For each={parts()}>{part => {
              const used = () => modulesUsing(part.id);
              return (
                <A class="card" href={`/parts/${part.id}`}>
                  <strong>{part.name}</strong>
                  <p>{part.summary}</p>
                  <span class="kicker">{used().length === 0 ? "Unused" : used().map(item => item.name).join(", ")}</span>
                </A>
              );
            }}</For>
          </div>
        </Show>
      </main>
    </Frame>
  );
}
