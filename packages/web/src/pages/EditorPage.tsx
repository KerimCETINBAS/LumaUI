import { A } from "@solidjs/router";

const groups = ["Layout", "Visuals", "Units", "Effects", "Components"];

export function EditorPage() {
  return (
    <div class="editor">
      <header class="topbar">
        <A class="wordmark" href="/">Luma</A>
        <span class="topbar-title">Untitled</span>
        <div class="topbar-actions">
          <button type="button" disabled>Undo</button>
          <button type="button" disabled>Redo</button>
          <button type="button" disabled>Save</button>
        </div>
      </header>
      <div class="ribbon">
        <div class="ribbon-tabs" role="tablist" aria-label="Element groups">
          {groups.map(group => <button type="button" role="tab" aria-selected={group === "Layout"}>{group}</button>)}
        </div>
        <div class="ribbon-tools" aria-label="Elements" />
      </div>
      <div class="workspace">
        <section class="panel column" aria-label="Hierarchy">
          <header>Hierarchy</header>
          <div class="column-body" />
        </section>
        <section class="panel column canvas" aria-label="Preview">
          <header>Preview</header>
          <div class="column-body" />
        </section>
        <section class="panel column" aria-label="Properties">
          <header>Properties</header>
          <div class="column-body" />
        </section>
      </div>
    </div>
  );
}
