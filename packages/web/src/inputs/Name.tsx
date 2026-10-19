import { createSignal, Show } from "solid-js";

/** The name reads as a label. Double-click it, or the pencil, to edit. */
export function NameField(props: { value: string; onChange: (value: string) => void }) {
  const [editing, setEditing] = createSignal(false);
  const [draft, setDraft] = createSignal(props.value);
  let input: HTMLInputElement | undefined;
  let canceling = false;

  function begin() {
    canceling = false;
    setDraft(props.value);
    setEditing(true);
    queueMicrotask(() => {
      input?.focus();
      input?.select();
    });
  }

  function commit() {
    if (canceling) {
      canceling = false;
      return;
    }
    setEditing(false);
    const next = draft().trim();
    if (next.length > 0 && next !== props.value) props.onChange(next);
  }

  function cancel() {
    canceling = true;
    setEditing(false);
  }

  return (
    <div class="name-field">
      <Show
        when={editing()}
        fallback={<button type="button" class="name-label" onDblClick={begin}>{props.value}</button>}
      >
        <input
          ref={input}
          class="control"
          type="text"
          aria-label="Name"
          value={draft()}
          onInput={event => setDraft(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={event => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") cancel();
          }}
        />
      </Show>
      <button type="button" class="name-edit" aria-label="Rename" onMouseDown={event => event.preventDefault()} onClick={begin}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M11.2 1.8l2.9 2.9L5.4 13.4 2 14l.6-3.4 8.6-8.8z" fill="none" stroke="currentColor" stroke-width="1.2" />
        </svg>
      </button>
    </div>
  );
}
