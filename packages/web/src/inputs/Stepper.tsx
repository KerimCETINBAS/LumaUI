import { createSignal, For } from "solid-js";

const steps = [1, 10, 100];

/** A number with minus, plus, and a step of 1, 10, or 100. */
export function Stepper(props: { value: string; onChange: (value: string) => void }) {
  const [step, setStep] = createSignal(1);
  const current = () => {
    const value = Number(props.value);
    return Number.isFinite(value) ? value : 0;
  };

  function nudge(direction: number) {
    props.onChange(String(current() + direction * step()));
  }

  return (
    <div class="stepper">
      <button type="button" aria-label="Decrease" onClick={() => nudge(-1)}>−</button>
      <input
        class="control numeric"
        type="text"
        inputmode="decimal"
        aria-label="Number"
        value={props.value}
        onInput={event => props.onChange(event.currentTarget.value)}
      />
      <button type="button" aria-label="Increase" onClick={() => nudge(1)}>+</button>
      <span class="segment" role="group" aria-label="Step">
        <For each={steps}>
          {item => <button type="button" aria-pressed={step() === item} onClick={() => setStep(item)}>{item}</button>}
        </For>
      </span>
    </div>
  );
}
