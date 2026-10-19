import { A } from "@solidjs/router";

export function LibraryPage() {
  return (
    <div class="library">
      <header class="topbar">
        <A class="wordmark" href="/">Luma</A>
        <span class="topbar-title">Components</span>
      </header>
      <main class="library-main">
        <div class="library-toolbar">
          <h1>Components</h1>
          <A class="button" href="/editor">New component</A>
        </div>
        <section class="panel library-list" aria-label="Component library" />
      </main>
    </div>
  );
}
