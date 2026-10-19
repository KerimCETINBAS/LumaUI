import { Show } from "solid-js";
import { A, useParams } from "@solidjs/router";
import { Frame } from "../shell/Frame";
import { Face } from "../inputs/Face";
import { Fields } from "../inputs/Controls";
import { findPrimitive } from "../primitives";

export function PrimitivePage() {
  const params = useParams<{ id: string }>();
  const primitive = () => findPrimitive(params.id);

  return (
    <Frame>
      <Show when={primitive()} fallback={<main class="page"><h1>Missing primitive</h1><A class="button" href="/primitives">Back</A></main>}>
        {item => (
          <main class="page">
            <div class="page-head">
              <div>
                <A class="back" href="/primitives">{item().group}</A>
                <h1>{item().name}</h1>
                <p class="lead">{item().summary}</p>
              </div>
            </div>
            <div class="primitive-detail">
              <div class="specimen">
                <Face id={item().id} />
              </div>
              <section class="panel inspector" aria-label="Inputs">
                <header>Inputs</header>
                <Show when={item().fields.length > 0} fallback={<p class="empty">This primitive takes no inputs.</p>}>
                  <Fields fields={item().fields} />
                </Show>
              </section>
            </div>
          </main>
        )}
      </Show>
    </Frame>
  );
}
