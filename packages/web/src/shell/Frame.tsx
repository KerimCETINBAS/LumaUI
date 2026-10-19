import type { JSX } from "solid-js";
import { A } from "@solidjs/router";

export function Frame(props: { children: JSX.Element }) {
  return (
    <div class="library">
      <header class="topbar">
        <A class="wordmark" href="/">Luma</A>
        <nav class="doors" aria-label="Libraries">
          <A href="/" end activeClass="door-active">Profiles</A>
          <A href="/parts" activeClass="door-active">Parts</A>
          <A href="/primitives" activeClass="door-active">Primitives</A>
          <A href="/click-cast" activeClass="door-active">Click Cast</A>
        </nav>
      </header>
      <div class="stage">{props.children}</div>
    </div>
  );
}
