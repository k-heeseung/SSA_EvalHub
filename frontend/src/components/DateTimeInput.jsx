import { useEffect, useId, useRef, useState } from 'react';

function TimePart({ value, onChange, max, unit, label, disabled, invalid }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef(null);
  const list = useRef(null);
  const input = useRef(null);
  const id = useId();
  const options = Array.from({ length: max + 1 }, (_, i) => String(i).padStart(2, '0'));

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const show = () => {
    setActive(/^\d{1,2}$/.test(value) && Number(value) <= max ? Number(value) : 0);
    setOpen(true);
    input.current?.focus();
  };
  const choose = (option) => { onChange(option); setOpen(false); input.current?.focus(); };
  const onKeyDown = (e) => {
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      if (!open) show();
      else setActive((previous) => Math.max(0, Math.min(max, previous + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter' && open) {
      e.preventDefault(); e.stopPropagation(); choose(options[active]);
    } else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={root} className="relative min-w-0" onBlur={(e) => {
      if (!e.currentTarget.contains(e.relatedTarget)) {
        setOpen(false);
        if (/^\d{1,2}$/.test(value) && Number(value) <= max) onChange(value.padStart(2, '0'));
      }
    }}>
      <div className={`flex items-center rounded-lg border bg-white focus-within:ring-2 focus-within:ring-blue-500 ${invalid ? 'border-red-400' : 'border-gray-200'} ${disabled ? 'bg-gray-50 text-gray-400' : ''}`}>
        <input ref={input} type="text" role="combobox" inputMode="numeric" maxLength={2}
          aria-label={label} aria-expanded={open && !disabled} aria-controls={`${id}-list`}
          aria-autocomplete="list" aria-activedescendant={open ? `${id}-${active}` : undefined}
          aria-invalid={invalid || undefined} value={value} disabled={disabled} placeholder="--"
          onChange={(e) => { onChange(e.target.value.replace(/\D/g, '').slice(0, 2)); setOpen(false); }}
          onKeyDown={onKeyDown} className="w-full min-w-0 bg-transparent py-2.5 pl-2 text-center text-sm outline-none disabled:cursor-not-allowed" />
        <span className="text-sm" aria-hidden="true">{unit}</span>
        <button type="button" disabled={disabled} aria-label={`${label} 선택 목록`} aria-expanded={open && !disabled}
          onClick={() => open ? setOpen(false) : show()} className="px-2 py-2 text-xs text-gray-400 hover:text-blue-600 disabled:cursor-not-allowed">▾</button>
      </div>
      {open && !disabled && (
        <ul ref={list} id={`${id}-list`} role="listbox" aria-label={label}
          className="absolute right-0 z-30 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((option, index) => (
            <li key={option} id={`${id}-${index}`} role="option" aria-selected={Number(value) === index && value !== ''}
              onMouseDown={(e) => e.preventDefault()} onClick={() => choose(option)}
              className={`cursor-pointer px-2 py-2 text-center text-sm hover:bg-blue-50 ${active === index ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}>{option}{unit}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DateTimeInput({ value = '', onChange, label, disabled = false, error }) {
  const picker = useRef(null);
  const id = useId();
  const [date = '', time = ''] = value.split('T');
  const [hour = '', minute = ''] = time.split(':');
  const set = (nextDate, nextHour, nextMinute) => {
    onChange(nextDate || nextHour || nextMinute ? `${nextDate}T${nextHour}:${nextMinute}` : '');
  };
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_5rem_5rem] gap-2" role="group" aria-label={label} aria-describedby={error ? `${id}-error` : undefined}>
        <div className="relative col-span-2 min-w-0 sm:col-span-1">
          <input ref={picker} type="date" value={date} aria-label={`${label} 날짜`} disabled={disabled}
            aria-invalid={!!error} onInput={(e) => set(e.currentTarget.value, hour, minute)} onChange={(e) => set(e.target.value, hour, minute)}
            className={`h-full w-full min-w-0 rounded-lg border bg-white px-2 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 ${error ? 'border-red-400' : 'border-gray-200'}`} />
        </div>
        <TimePart value={hour} onChange={(next) => set(date, next, minute)} max={23} unit="시" label={`${label} 시`} disabled={disabled} invalid={!!error} />
        <TimePart value={minute} onChange={(next) => set(date, hour, next)} max={59} unit="분" label={`${label} 분`} disabled={disabled} invalid={!!error} />
      </div>
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs text-red-500" role="alert">{error}</p>}
    </div>
  );
}
