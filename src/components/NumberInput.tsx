import { useEffect, useState, type InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | null;
  onChange: (value: number | null) => void;
}

/** A text box for optional numbers that keeps partial input such as "3," while typing. */
export function NumberInput({ value, onChange, ...rest }: Props) {
  const [text, setText] = useState(toText(value));

  useEffect(() => {
    if (parse(text) !== value) setText(toText(value));
    // Only react to changes coming from outside this input.
  }, [value]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const parsed = parse(e.target.value);
        if (parsed !== undefined) onChange(parsed);
      }}
      onBlur={(e) => {
        setText(toText(value));
        rest.onBlur?.(e);
      }}
    />
  );
}

function toText(value: number | null): string {
  return value === null ? '' : String(value);
}

/** Null for an empty box, undefined while the text is not a number yet. */
function parse(text: string): number | null | undefined {
  const cleaned = text.replace(/[\s  ]/g, '').replace(',', '.');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}
