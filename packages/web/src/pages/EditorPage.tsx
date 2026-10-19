import { A } from "@solidjs/router";
import { createEffect, createSignal, For, Show } from "solid-js";
import { Element } from "../elements/Element";
import { adopt, createElement, documentFromSamples } from "../elements/primitives";
import { AnchorControl, Fields } from "../inputs/Controls";
import { NameField } from "../inputs/Name";
import { Stepper } from "../inputs/Stepper";
import { modules, partReferencePaths, resolvePart, type SampleNode } from "../library";
import { groups, primitives, primitivesIn, type PrimitiveField, type PrimitiveSpec } from "../primitives";
import { CanvasPreview } from "../preview/CanvasPreview";
import { readMarkup, xmlTag } from "../source/markup";
import { SourceView } from "../source/SourceView";

function fieldsFor(element: Element, role: "Module" | "Part" | "Region", depth: number): PrimitiveField[] {
  const kind = element.tag;
  const name = element.label;
  let fields: PrimitiveField[];
  if (role === "Region" && depth === 0) return [];
  if (role === "Region" && kind === "Module") return [];
  if (kind === "Part" && !(role === "Part" && depth === 0)) {
    fields = [{ kind: "part", label: "partName", value: name === "Part" ? "" : name, hint: "Part name" }];
  } else if (kind === "Part") {
    fields = [
      { kind: "text", label: "Name", value: name },
      { kind: "size", label: "Width", value: "140" },
      { kind: "size", label: "Height", value: "40" },
      { kind: "anchor", label: "Anchor" },
    ];
  } else {
    const known = primitives.find(item => item.name.toLowerCase() === kind.toLowerCase() || item.id === kind.toLowerCase());
    fields = known !== undefined ? known.fields : [
      { kind: "text", label: "Name", value: name },
      { kind: "size", label: "Width", value: "140" },
      { kind: "size", label: "Height", value: "40" },
      { kind: "anchor", label: "Anchor" },
    ];
  }
  return fields.map(field => ({ ...field, value: element.props[field.label] ?? field.value }));
}

function rowsOf(element: Element, depth = 0): { element: Element; depth: number }[] {
  return [{ element, depth }, ...element.children.flatMap(child => rowsOf(child, depth + 1))];
}

function markupOf(root: Element): string {
  return root.children.map(child => child.source(0)).join("\n");
}

function CellInspector(props: { revision: number; element: Element; onName: (value: string) => void; onProp: (name: string, value: string) => void }) {
  const prop = (name: string, fallback: string) => {
    props.revision;
    return props.element.props[name] ?? fallback;
  };
  return (
    <div class="fields">
      <div class="field">
        <span>Name</span>
        <NameField value={prop("name", props.element.tag)} onChange={props.onName} />
      </div>
      <div class="field">
        <span>Width</span>
        <Stepper value={prop("width", "140")} onChange={value => props.onProp("width", value)} />
      </div>
      <div class="field">
        <span>Height</span>
        <Stepper value={prop("height", "40")} onChange={value => props.onProp("height", value)} />
      </div>
      <div class="field">
        <span>Anchor</span>
        <AnchorControl value={prop("anchor", "C")} onChange={value => props.onProp("anchor", value)} />
      </div>
      <div class="field">
        <span>Offset X</span>
        <Stepper value={prop("offsetX", "0")} onChange={value => props.onProp("offsetX", value)} />
      </div>
      <div class="field">
        <span>Offset Y</span>
        <Stepper value={prop("offsetY", "0")} onChange={value => props.onProp("offsetY", value)} />
      </div>
    </div>
  );
}

function RegionInspector(props: { revision: number; element: Element; depth: number; profileId?: string; onProp: (name: string, value: string) => void }) {
  const prop = (name: string, fallback: string) => {
    props.revision;
    return props.element.props[name] ?? fallback;
  };
  const part = () => resolvePart(prop("partName", props.element.props.name ?? ""), props.profileId);
  return (
    <Show when={props.depth > 0} fallback={<p class="empty">Children stay where they are anchored. A part path is Part, Region.Part, or Profile.Region.Part.</p>}>
      <Show when={props.element.tag === "Part"}>
        <Fields
          fields={[{ kind: "part", label: "partName", value: prop("partName", ""), hint: "Part, Region.Part, or Profile.Region.Part" }]}
          profileId={props.profileId}
          onChange={(_label, value) => { props.onProp("partName", value); props.onProp("name", value); }}
        />
      </Show>
      <div class="fields">
        <div class="field">
          <span>Anchor</span>
          <AnchorControl value={prop("anchor", "C")} onChange={value => props.onProp("anchor", value)} />
        </div>
        <div class="field">
          <span>Offset X</span>
          <Stepper value={prop("offsetX", "0")} onChange={value => props.onProp("offsetX", value)} />
        </div>
        <div class="field">
          <span>Offset Y</span>
          <Stepper value={prop("offsetY", "0")} onChange={value => props.onProp("offsetY", value)} />
        </div>
      </div>
      <Show when={props.element.tag === "Module" && (props.element.props.moduleId?.length ?? 0) > 0}>
        <A class="button" href={`/modules/${props.element.props.moduleId}`}>Open module</A>
      </Show>
      <Show when={props.element.tag === "Part" && part() !== undefined}>
        <A class="button" href={`/parts/${part()!.id}`}>Open part</A>
      </Show>
    </Show>
  );
}

export function EditorPage(props: {
  title: string;
  role: "Module" | "Part" | "Region";
  blurb: string;
  usedBy: string[];
  nodes: SampleNode[];
  profileId?: string;
  onCommit: (nodes: SampleNode[]) => void;
}) {
  const root = documentFromSamples(props.nodes);
  const [title, setTitle] = createSignal(props.title);
  const [revision, setRevision] = createSignal(0);
  const [mode, setMode] = createSignal<"visual" | "source">("visual");
  const [source, setSource] = createSignal("");
  const [problem, setProblem] = createSignal("");
  const [selected, setSelected] = createSignal(props.nodes[0]?.id ?? root.id);
  const [query, setQuery] = createSignal("");
  const [cursor, setCursor] = createSignal(0);
  const [picker, setPicker] = createSignal<{ x: number; y: number; parentId?: string }>();
  const outline = () => {
    revision();
    return rowsOf(root);
  };
  const current = () => {
    revision();
    return root.find(selected());
  };
  const sections = () => {
    const text = query().trim().toLowerCase();
    return groups.flatMap(group => {
      const items = primitivesIn(group).filter(item => item.name.toLowerCase().includes(text));
      return items.length > 0 ? [{ group, items }] : [];
    });
  };
  const matches = () => sections().flatMap(section => section.items);
  let search: HTMLInputElement | undefined;
  let draft = 0;

  function touch() {
    setRevision(value => value + 1);
    props.onCommit(savedNodes());
  }

  function savedNodes(): SampleNode[] {
    const nodes: SampleNode[] = [];
    function walk(element: Element, depth: number) {
      nodes.push({
        id: element.id,
        name: element.props.partName || element.props.name || element.tag,
        kind: depth === 0 ? props.role : element.tag,
        depth,
        attrs: { ...element.props },
      });
      for (const child of element.children) walk(child, depth + 1);
    }
    walk(root, 0);
    return nodes;
  }

  function renameDocument(value: string) {
    setTitle(value);
    root.props.name = value;
    touch();
  }

  createEffect(() => {
    if (picker() === undefined) return;
    queueMicrotask(() => search?.focus());
  });

  function openPicker(event: MouseEvent, parentId?: string) {
    event.preventDefault();
    event.stopPropagation();
    setQuery("");
    setCursor(0);
    if (props.role === "Region") parentId = root.id;
    if (parentId !== undefined) setSelected(parentId);
    const width = 240;
    const height = 320;
    setPicker({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8)),
      parentId,
    });
  }

  function add(primitive: PrimitiveSpec) {
    const parent = root.find(picker()?.parentId ?? "") ?? root;
    const child = createElement(xmlTag(primitive.name), `${primitive.id}-${draft}`);
    draft += 1;
    if (child.tag === "Cell") {
      child.props.name = "Cell";
      child.props.width = "140";
      child.props.height = "40";
      child.props.anchor = "C";
      child.props.offsetX = "0";
      child.props.offsetY = "0";
    } else if (child.tag !== "Part") {
      child.props.name = primitive.name;
    }
    parent.children = [...parent.children, child];
    touch();
    if (mode() === "source") setSource(markupOf(root));
    setSelected(child.id);
    setPicker(undefined);
  }

  function placeSections(): { group: string; items: { name: string; kind: "Module" | "Part" }[] }[] {
    const text = query().trim().toLowerCase();
    const taken = new Set(root.children.filter(child => child.tag === "Module").map(child => child.props.moduleId || child.id));
    const moduleItems = modules().filter(item => !item.headless && !taken.has(item.id) && item.name.toLowerCase().includes(text)).map(item => item.name);
    const paths = partReferencePaths(props.profileId).filter(item => item.path.toLowerCase().includes(text));
    const sections: { group: string; items: { name: string; kind: "Module" | "Part" }[] }[] = [];
    if (moduleItems.length > 0) sections.push({ group: "Module", items: moduleItems.map(name => ({ name, kind: "Module" })) });
    for (const scope of ["Part", "Region", "Profile"] as const) {
      const items = paths.filter(item => item.scope === scope).map(item => ({ name: item.path, kind: "Part" as const }));
      if (items.length === 0) continue;
      const group = scope === "Part" ? "Part" : scope === "Region" ? "Region.Part" : "Profile.Region.Part";
      sections.push({ group, items });
    }
    return sections;
  }

  function placeSaved(choice: { name: string; kind: "Module" | "Part" }) {
    const index = root.children.length;
    const child = choice.kind === "Module"
      ? createElement("Module", modules().find(item => item.name === choice.name)?.id ?? `module-${draft}`)
      : createElement("Part", `part-${draft}`);
    draft += 1;
    child.props.anchor = "C";
    child.props.offsetX = String(index * 12);
    child.props.offsetY = String(index * 12);
    if (choice.kind === "Module") {
      const item = modules().find(entry => entry.name === choice.name);
      child.props.name = choice.name;
      if (item !== undefined) child.props.moduleId = item.id;
    } else {
      child.props.partName = choice.name;
      child.props.name = choice.name;
    }
    root.children = [...root.children, child];
    touch();
    setSelected(child.id);
    setPicker(undefined);
  }

  function setProp(name: string, value: string) {
    const element = root.find(selected());
    if (element === undefined) return;
    element.props[name] = value;
    touch();
  }

  function rename(value: string) {
    setProp("name", value);
  }

  function editSource(value: string) {
    setSource(value);
    const result = readMarkup(value);
    if ("error" in result) {
      setProblem(result.error);
      return;
    }
    setProblem("");
    root.children = adopt(result.nodes);
    if (root.find(selected()) === undefined) setSelected(root.id);
    touch();
  }

  function showSource() {
    setSource(markupOf(root));
    setProblem("");
    setMode("source");
  }

  function showVisual() {
    const result = readMarkup(source());
    if ("error" in result) {
      setProblem(result.error);
      return;
    }
    setProblem("");
    setMode("visual");
  }

  function onSearchKey(event: KeyboardEvent) {
    const items = props.role === "Region" ? placeSections().flatMap(section => section.items) : matches();
    if (event.key === "Escape") {
      setPicker(undefined);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor(index => Math.min(index + 1, Math.max(items.length - 1, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor(index => Math.max(index - 1, 0));
    }
    if (event.key === "Enter" && items[cursor()] !== undefined) {
      event.preventDefault();
      if (props.role === "Region") placeSaved(items[cursor()] as { name: string; kind: "Module" | "Part" });
      else add(items[cursor()] as PrimitiveSpec);
    }
  }

  return (
    <div class="editor-page">
      <div class="page-head editor-head">
        <div>
          <h1><NameField value={title()} onChange={renameDocument} /></h1>
          <p class="lead">{props.blurb}</p>
        </div>
        <div class="head-actions">
          <div class="segment" role="group" aria-label="Editor mode">
            <button type="button" aria-pressed={mode() === "visual"} onClick={showVisual}>Visual</button>
            <button type="button" aria-pressed={mode() === "source"} onClick={showSource}>Source</button>
          </div>
          <Show when={props.usedBy.length > 0}>
            <div class="chips">
              <For each={props.usedBy}>{name => <span class="chip">{name}</span>}</For>
            </div>
          </Show>
        </div>
      </div>
      <div class="workspace" classList={{ "source-open": mode() === "source" }}>
        <section class="panel column" aria-label="Hierarchy">
          <header>Hierarchy</header>
          <div class="column-body tree" onContextMenu={event => openPicker(event, root.id)}>
            <Show when={outline().length > 0} fallback={<p class="empty">{props.role === "Region" ? "Right-click to place a module or a part." : "Right-click to add something here."}</p>}>
              <For each={outline()}>
                {item => (
                  <button
                    type="button"
                    class="tree-item"
                    aria-selected={current()?.id === item.element.id}
                    style={{ "padding-left": `${10 + item.depth * 16}px` }}
                    onClick={() => setSelected(item.element.id)}
                    onContextMenu={event => openPicker(event, item.element.id)}
                  >
                    <span>{item.element.label}</span>
                    <small>{item.depth === 0 ? props.role : item.element.tag}</small>
                  </button>
                )}
              </For>
            </Show>
          </div>
        </section>
        <section class="panel column canvas" aria-label="Preview">
          <header>Preview</header>
          <div class="column-body preview">
            <CanvasPreview root={root} revision={revision()} selected={current()?.id} profileId={props.profileId} hint={props.role === "Region" ? "Right-click the hierarchy to place a module or a part." : undefined} onSelect={setSelected} />
          </div>
        </section>
        <Show when={mode() === "source"}>
          <section class="panel column source-panel" aria-label="Source">
            <header>Source</header>
            <SourceView value={source()} problem={problem()} onChange={editSource} />
          </section>
        </Show>
        <Show when={mode() === "visual"}>
          <section class="panel column" aria-label="Properties">
            <header>Properties</header>
            <div class="column-body props">
              <Show when={current()} fallback={<p class="empty">Select something in the hierarchy.</p>}>
                <Show
                  when={props.role === "Region" ? current()?.id : false}
                  keyed
                  fallback={
                    <Show
                      when={current()?.tag === "Cell"}
                      fallback={
                        <Fields
                          fields={fieldsFor(current()!, props.role, outline().find(row => row.element.id === current()?.id)?.depth ?? 0)}
                          profileId={props.profileId}
                          onChange={(label, value) => {
                            const node = current();
                            if (node === undefined) return;
                            node.props[label] = value;
                            if (label === "Name") node.props.name = value;
                            touch();
                          }}
                        />
                      }
                    >
                      <CellInspector revision={revision()} element={current()!} onName={rename} onProp={setProp} />
                    </Show>
                  }
                >
                  {id => <RegionInspector revision={revision()} element={root.find(id) ?? root} depth={outline().find(row => row.element.id === id)?.depth ?? 0} profileId={props.profileId} onProp={setProp} />}
                </Show>
              </Show>
            </div>
          </section>
        </Show>
      </div>
      <Show when={picker()}>
        {place => (
          <>
            <div class="node-menu-backdrop" onMouseDown={() => setPicker(undefined)} onContextMenu={event => { event.preventDefault(); setPicker(undefined); }} />
            <div class="node-menu" role="dialog" aria-label="Add" style={{ left: `${place().x}px`, top: `${place().y}px` }}>
              <input
                ref={search}
                class="control"
                type="text"
                placeholder={props.role === "Region" ? "Place" : "Add"}
                value={query()}
                onInput={event => { setQuery(event.currentTarget.value); setCursor(0); }}
                onKeyDown={onSearchKey}
              />
              <div class="node-menu-list">
                <Show when={props.role === "Region"} fallback={
                <For each={sections()}>
                  {section => {
                    const offset = () => sections().slice(0, sections().indexOf(section)).reduce((count, item) => count + item.items.length, 0);
                    return (
                      <section>
                        <h3>{section.group}</h3>
                        <For each={section.items}>
                          {(item, index) => (
                            <button
                              type="button"
                              aria-selected={cursor() === offset() + index()}
                              onMouseDown={event => event.preventDefault()}
                              onMouseEnter={() => setCursor(offset() + index())}
                              onClick={() => add(item)}
                            >
                              {item.name}
                            </button>
                          )}
                        </For>
                      </section>
                    );
                  }}
                </For>
                }>
                  <Show when={placeSections().length > 0} fallback={<p class="empty">Nothing saved to place yet.</p>}>
                    <For each={placeSections()}>
                      {section => {
                        const offset = () => placeSections().slice(0, placeSections().indexOf(section)).reduce((count, item) => count + item.items.length, 0);
                        return (
                          <section>
                            <h3>{section.group}</h3>
                            <For each={section.items}>
                              {(item, index) => (
                                <button
                                  type="button"
                                  aria-selected={cursor() === offset() + index()}
                                  onMouseDown={event => event.preventDefault()}
                                  onMouseEnter={() => setCursor(offset() + index())}
                                  onClick={() => placeSaved(item)}
                                >
                                  {item.name}
                                </button>
                              )}
                            </For>
                          </section>
                        );
                      }}
                    </For>
                  </Show>
                </Show>
              </div>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}
