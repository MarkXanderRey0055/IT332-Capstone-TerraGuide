import React from 'react';

interface CurrencyInputProps {
  value: number | '';
  onChange: (value: number | '') => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

// type="number" inputs can't display "1,000,000" at all — browsers reject
// commas outright. This stays a plain text input, strips everything but
// digits on every keystroke, and only ever hands the parent a real number
// (or '' when empty) — the comma formatting never touches actual state.
export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  required,
}) => {
  const displayValue = value === '' ? '' : value.toLocaleString('en-US');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/[^\d]/g, '');
    if (digitsOnly === '') {
      onChange('');
      return;
    }
    onChange(Number(digitsOnly));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={className}
    />
  );
};

export default CurrencyInput;
