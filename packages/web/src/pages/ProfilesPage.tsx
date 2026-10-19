import { For, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { Frame } from "../shell/Frame";
import { createProfile, profiles } from "../library";

export function ProfilesPage() {
  const navigate = useNavigate();
  return (
    <Frame>
      <main class="page">
        <div class="page-head">
          <div>
            <h1>Profiles</h1>
            <p class="lead">A profile decides which regions and modules are on, and when. Open one to see its regions.</p>
          </div>
          <button class="primary" type="button" onClick={() => navigate(`/profiles/${createProfile().id}`)}>New profile</button>
        </div>
        <Show when={profiles().length > 0} fallback={<p class="empty">No profiles yet.</p>}>
          <div class="card-grid">
            <For each={profiles()}>{profile => (
              <A class="card" href={`/profiles/${profile.id}`}>
                <strong>{profile.name}</strong>
                <p>{profile.summary}</p>
                <span class="kicker">{profile.activation.length > 0 ? profile.activation.join(" · ") : "Not set yet"}</span>
              </A>
            )}</For>
          </div>
        </Show>
      </main>
    </Frame>
  );
}
