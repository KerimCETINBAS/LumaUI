import { createSignal } from "solid-js";
import { A } from "@solidjs/router";
import { Frame } from "../shell/Frame";
import { Fields } from "../inputs/Controls";
import { NameField } from "../inputs/Name";
import { inputSpecimens } from "../primitives";

export function InputsPage() {
  const [name, setName] = createSignal("Health bar");
  return (
    <Frame>
      <main class="page">
        <div class="page-head">
          <div>
            <A class="back" href="/primitives">Primitives</A>
            <h1>Inputs</h1>
            <p class="lead">The controls an inspector uses. Nothing here is saved.</p>
          </div>
        </div>
        <section class="panel inspector specimen-sheet" aria-label="Input specimens">
          <header>Inspector</header>
          <div class="fields">
            <div class="field">
              <span>Name</span>
              <NameField value={name()} onChange={setName} />
            </div>
          </div>
          <Fields fields={inputSpecimens} />
        </section>
      </main>
    </Frame>
  );
}
