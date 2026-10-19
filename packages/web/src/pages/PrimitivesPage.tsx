import { For } from "solid-js";
import { A } from "@solidjs/router";
import { Frame } from "../shell/Frame";
import { Face } from "../inputs/Face";
import { groups, primitivesIn } from "../primitives";

export function PrimitivesPage() {
  return (
    <Frame>
      <main class="page">
        <div class="page-head">
          <div>
            <h1>Primitives</h1>
            <p class="lead">Layouts, data, visuals, and effects. A module builds its hierarchy from these. A part is optional.</p>
          </div>
          <A class="button" href="/primitives/inputs">Inputs</A>
        </div>
        <div class="stack">
          <For each={groups}>
            {group => (
              <section>
                <h2>{group}</h2>
                <div class="shelf">
                  <For each={primitivesIn(group)}>
                    {item => (
                      <A class="card primitive-card" href={`/primitives/${item.id}`}>
                        <Face id={item.id} />
                        <span class="kicker">{group}</span>
                        <h3>{item.name}</h3>
                        <p>{item.summary}</p>
                      </A>
                    )}
                  </For>
                </div>
              </section>
            )}
          </For>
        </div>
      </main>
    </Frame>
  );
}
