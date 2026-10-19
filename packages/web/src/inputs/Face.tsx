export function Face(props: { id: string }) {
  const id = () => props.id;
  return (
    <div class={`face face-${id()}`} aria-hidden="true">
      {id() === "cell" && <i class="face-box" />}
      {id() === "flow" && <span class="face-stack"><i /><i /><i /></span>}
      {id() === "grid" && <span class="face-grid"><i /><i /><i /><i /></span>}
      {id() === "each" && <span class="face-each"><i /><i /><i /></span>}
      {id() === "region" && <span class="face-region"><i /><b /></span>}
      {id() === "part" && <span class="face-part"><i /><b>Health bar</b></span>}
      {id() === "slot" && <span class="face-slot" />}
      {id() === "number" && <em>650</em>}
      {id() === "text" && <em>Ada</em>}
      {id() === "boolean" && <span class="face-toggle" />}
      {id() === "color" && <span class="face-swatch" />}
      {id() === "list" && <span class="face-chips"><i /><i /><i /></span>}
      {id() === "unit" && <em>player</em>}
      {id() === "bar" && <span class="face-bar"><i /></span>}
      {id() === "label" && <em class="face-label">Health</em>}
      {id() === "icon" && <span class="face-icon" />}
      {id() === "portrait" && <span class="face-portrait" />}
      {id() === "button" && <span class="face-key">1</span>}
      {id() === "hide-frames" && <span class="face-hide" />}
      {id() === "nameplate" && <span class="face-plate"><i /><b /></span>}
    </div>
  );
}
