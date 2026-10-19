import { createSignal, For } from "solid-js";
import { Frame } from "../shell/Frame";

interface ClickSample {
  id: string;
  gesture: string;
  action: string;
}

const clickCast: ClickSample[] = [
  { id: "left", gesture: "Left click", action: "Target" },
  { id: "shift", gesture: "Shift-Left", action: "Focus" },
  { id: "ctrl", gesture: "Ctrl-Left", action: "Assist" },
];

export function ClickCastPage() {
  const [rows, setRows] = createSignal<ClickSample[]>(clickCast);
  let next = clickCast.length;

  function addBinding() {
    next += 1;
    setRows(current => [...current, { id: `draft-${next}`, gesture: "Unassigned", action: "Untitled" }]);
  }

  return (
    <Frame>
      <main class="page">
        <div class="page-head">
          <div>
            <h1>Click Cast</h1>
            <p class="lead">Bindings stay in their own library, apart from profiles, modules, and parts.</p>
          </div>
          <button class="primary" type="button" onClick={addBinding}>New binding</button>
        </div>
        <div class="rows">
          <For each={rows()}>
            {row => (
              <article class="row">
                <span>
                  <strong>{row.gesture}</strong>
                  <small>{row.action}</small>
                </span>
                <span class="kicker">Binding</span>
              </article>
            )}
          </For>
        </div>
      </main>
    </Frame>
  );
}
