import { createEffect, createSignal, createUniqueId, For, Show } from "solid-js";
import { partReferencePaths, resolvePart } from "../library";
import type { PrimitiveField } from "../primitives";
import { Stepper } from "./Stepper";

const anchors = ["TL", "T", "TR", "L", "C", "R", "BL", "B", "BR"];

export function Fields(props: { fields: PrimitiveField[]; profileId?: string; onChange?: (label: string, value: string) => void }) {
  return (
    <div class="fields">
      <For each={props.fields}>{field => <FieldControl field={field} profileId={props.profileId} onChange={value => props.onChange?.(field.label, value)} />}</For>
    </div>
  );
}

function FieldControl(props: { field: PrimitiveField; profileId?: string; onChange?: (value: string) => void }) {
  const id = createUniqueId();
  return (
    <div class="field">
      <span id={id}>{props.field.label}</span>
      <div aria-labelledby={id}>
        <SwitchControl field={props.field} profileId={props.profileId} onChange={props.onChange} />
      </div>
    </div>
  );
}

function SwitchControl(props: { field: PrimitiveField; profileId?: string; onChange?: (value: string) => void }) {
  const kind = () => props.field.kind;
  return (
    <>
      <Show when={kind() === "text"}><TextControl value={props.field.value ?? ""} onChange={props.onChange} /></Show>
      <Show when={kind() === "number"}><NumberStepper value={props.field.value ?? "0"} onChange={props.onChange} /></Show>
      <Show when={kind() === "size"}><SizeControl value={props.field.value ?? "0"} /></Show>
      <Show when={kind() === "toggle"}><ToggleControl /></Show>
      <Show when={kind() === "choice"}><ChoiceControl options={props.field.options ?? []} value={props.field.value} onChange={props.onChange} /></Show>
      <Show when={kind() === "color"}><ColorControl /></Show>
      <Show when={kind() === "anchor"}><AnchorControl /></Show>
      <Show when={kind() === "offset"}><OffsetControl /></Show>
      <Show when={kind() === "spacing"}><SpacingControl /></Show>
      <Show when={kind() === "texture"}><TextureControl /></Show>
      <Show when={kind() === "search"}><SearchControl hint={props.field.hint} /></Show>
      <Show when={kind() === "unit"}><ChoiceControl options={["player", "target", "pet", "party1"]} value={props.field.value ?? "player"} onChange={props.onChange} /></Show>
      <Show when={kind() === "list"}><ListControl value={props.field.value ?? ""} /></Show>
      <Show when={kind() === "keybind"}><KeybindControl value={props.field.value ?? ""} /></Show>
      <Show when={kind() === "part"}><PartControl value={props.field.value ?? ""} hint={props.field.hint} profileId={props.profileId} onChange={props.onChange} /></Show>
    </>
  );
}

function TextControl(props: { value: string; onChange?: (value: string) => void }) {
  const [value, setValue] = createSignal(props.value);
  return <input class="control" type="text" value={value()} onInput={event => { setValue(event.currentTarget.value); props.onChange?.(event.currentTarget.value); }} />;
}

function NumberStepper(props: { value: string; onChange?: (value: string) => void }) {
  const [value, setValue] = createSignal(props.value);
  return <Stepper value={value()} onChange={next => { setValue(next); props.onChange?.(next); }} />;
}

function NumberControl(props: { value: string; onChange?: (value: string) => void }) {
  const [value, setValue] = createSignal(props.value);
  return <input class="control numeric" type="text" inputmode="decimal" value={value()} onInput={event => { setValue(event.currentTarget.value); props.onChange?.(event.currentTarget.value); }} />;
}

function SizeControl(props: { value: string }) {
  const [mode, setMode] = createSignal(props.value === "inherit" || props.value === "fill" ? props.value : "number");
  const [value, setValue] = createSignal(mode() === "number" ? props.value : "140");
  return (
    <div class="size-control">
      <Show when={mode() === "number"} fallback={<span class="control read">{mode()}</span>}>
        <input class="control numeric" type="text" inputmode="decimal" value={value()} onInput={event => setValue(event.currentTarget.value)} />
      </Show>
      <span class="segment" role="group" aria-label="Size mode">
        <For each={["number", "inherit", "fill"]}>
          {item => <button type="button" aria-pressed={mode() === item} onClick={() => setMode(item)}>{item === "number" ? "#" : item}</button>}
        </For>
      </span>
    </div>
  );
}

function ToggleControl() {
  const [on, setOn] = createSignal(true);
  return <button type="button" class="toggle" aria-pressed={on()} onClick={() => setOn(value => !value)}><i /></button>;
}

function ChoiceControl(props: { options: string[]; value?: string; onChange?: (value: string) => void }) {
  const [value, setValue] = createSignal(props.value ?? props.options[0] ?? "");
  return (
    <span class="segment" role="group">
      <For each={props.options}>
        {option => <button type="button" aria-pressed={value() === option} onClick={() => { setValue(option); props.onChange?.(option); }}>{option}</button>}
      </For>
    </span>
  );
}

function ColorControl() {
  const [hex, setHex] = createSignal("#2e74c4");
  const [alpha, setAlpha] = createSignal("100");
  return (
    <div class="color-control">
      <input class="color-picker" type="color" aria-label="Pick color" value={hex()} onInput={event => setHex(event.currentTarget.value)} />
      <span class="control read">{hex()}</span>
      <span class="color-alpha">A</span>
      <NumberControl value={alpha()} onChange={setAlpha} />
    </div>
  );
}

export function AnchorControl(props: { value?: string; onChange?: (value: string) => void }) {
  const [point, setPoint] = createSignal(props.value ?? "C");
  createEffect(() => setPoint(props.value ?? "C"));
  function choose(item: string) {
    setPoint(item);
    props.onChange?.(item);
  }
  return (
    <div class="anchor" role="group" aria-label="Anchor">
      <For each={anchors}>
        {item => <button type="button" aria-pressed={point() === item} onClick={() => choose(item)}>{item}</button>}
      </For>
    </div>
  );
}

function OffsetControl() {
  return (
    <div class="pair">
      <NumberControl value="0" />
      <NumberControl value="0" />
    </div>
  );
}

function SpacingControl() {
  return (
    <div class="spacing">
      <span class="space-top"><NumberControl value="0" /></span>
      <span class="space-left"><NumberControl value="0" /></span>
      <i />
      <span class="space-right"><NumberControl value="0" /></span>
      <span class="space-bottom"><NumberControl value="0" /></span>
    </div>
  );
}

function TextureControl() {
  const [name, setName] = createSignal("Interface\\Buttons\\WHITE8X8");
  return (
    <div class="texture">
      <i />
      <input class="control" type="text" value={name()} onInput={event => setName(event.currentTarget.value)} />
    </div>
  );
}

function SearchControl(props: { hint?: string }) {
  const [query, setQuery] = createSignal("");
  const [open, setOpen] = createSignal(false);
  const matches = () => ["Holy Light", "Flash of Light", "Judgement"].filter(item => item.toLowerCase().includes(query().toLowerCase()));
  return (
    <div class="search">
      <input class="control" type="text" placeholder={props.hint ?? "Search"} value={query()} onInput={event => { setQuery(event.currentTarget.value); setOpen(true); }} onFocus={() => setOpen(true)} />
      <Show when={open() && query().length > 0}>
        <ul>
          <For each={matches()}>{item => <li><button type="button" onClick={() => { setQuery(item); setOpen(false); }}>{item}</button></li>}</For>
        </ul>
      </Show>
    </div>
  );
}

function PartControl(props: { value: string; hint?: string; profileId?: string; onChange?: (value: string) => void }) {
  const [query, setQuery] = createSignal(props.value);
  const [open, setOpen] = createSignal(false);
  const matches = () => partReferencePaths(props.profileId).filter(item => item.path.toLowerCase().includes(query().trim().toLowerCase()));
  return (
    <div class="search part-combo">
      <input
        class="control"
        type="text"
        placeholder={props.hint ?? "Part, Region.Part, or Profile.Region.Part"}
        value={query()}
        onInput={event => { setQuery(event.currentTarget.value); setOpen(true); props.onChange?.(event.currentTarget.value); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      <Show when={open()}>
        <ul>
          <Show when={matches().length > 0} fallback={<li class="part-empty">No parts match</li>}>
            <For each={matches()}>
              {item => (
                <li>
                  <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => { setQuery(item.path); setOpen(false); props.onChange?.(item.path); }}
                  >
                    <PartPreview name={item.path} profileId={props.profileId} />
                    <span>{item.path}</span>
                    <small class="part-scope">{item.scope}</small>
                  </button>
                </li>
              )}
            </For>
          </Show>
        </ul>
      </Show>
    </div>
  );
}

export function ReferenceControl(props: { paths: { path: string; scope: string }[]; placeholder: string; onPick: (path: string) => void }) {
  const [query, setQuery] = createSignal("");
  const [open, setOpen] = createSignal(false);
  const matches = () => props.paths.filter(item => item.path.toLowerCase().includes(query().trim().toLowerCase()));
  return (
    <div class="search part-combo">
      <input
        class="control"
        type="text"
        placeholder={props.placeholder}
        value={query()}
        onInput={event => { setQuery(event.currentTarget.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      <Show when={open() && matches().length > 0}>
        <ul>
          <For each={matches()}>
            {item => (
              <li>
                <button
                  type="button"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => { setQuery(""); setOpen(false); props.onPick(item.path); }}
                >
                  <span>{item.path}</span>
                  <small class="part-scope">{item.scope}</small>
                </button>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}

function PartPreview(props: { name: string; profileId?: string }) {
  const bits = () => resolvePart(props.name, props.profileId)?.nodes.filter(node => node.depth > 0) ?? [];
  return (
    <span class="part-preview" aria-hidden="true">
      <For each={bits()}>{node => <i class={`part-bit part-bit-${node.kind.toLowerCase()}`} />}</For>
    </span>
  );
}

function ListControl(props: { value: string }) {
  const [items, setItems] = createSignal(props.value.split(",").map(item => item.trim()).filter(item => item.length > 0));
  const [draft, setDraft] = createSignal("");
  function add() {
    const next = draft().trim();
    if (next.length === 0) return;
    setItems(current => [...current, next]);
    setDraft("");
  }
  return (
    <div class="list-control">
      <div class="chips">
        <For each={items()}>
          {(item, index) => <button type="button" class="chip" onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index()))}>{item}</button>}
        </For>
      </div>
      <input class="control" type="text" placeholder="Add" value={draft()} onInput={event => setDraft(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Enter") add(); }} />
    </div>
  );
}

function KeybindControl(props: { value: string }) {
  const [value, setValue] = createSignal(props.value);
  const [listening, setListening] = createSignal(false);
  return <button type="button" class="control keybind" aria-pressed={listening()} onClick={() => setListening(value => !value)} onKeyDown={event => { if (!listening()) return; event.preventDefault(); setValue(event.key.toUpperCase()); setListening(false); }}>{listening() ? "Press a key" : value() || "Unassigned"}</button>;
}
