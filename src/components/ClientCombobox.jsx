import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Check, Search, UserPlus, X } from 'lucide-react';
import { clientIdentity, clientSelectionAfterQueryEdit, filterClientOptions, isClientSelectionValueValid, nextClientOptionIndex } from '../lib/clientSearch';
import './ClientCombobox.css';

const ClientCombobox = forwardRef(function ClientCombobox({
  clients = [],
  value = '',
  onChange,
  label = 'العميل',
  placeholder = 'ابحث بالاسم أو رقم الهاتف',
  allowedStatuses = ['active'],
  allowAll = false,
  allValue = 'all',
  allLabel = 'كل العملاء',
  onCreateClient,
  required = false,
  disabled = false,
  invalid = false,
  describedBy,
  id,
  className = '',
  inputProps = {},
}, forwardedRef) {
  const generatedId = useId().replaceAll(':', '');
  const inputRef = useRef(null);
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const selected = clients.find(client => String(client.id) === String(value));
  const isAll = allowAll && String(value) === String(allValue);
  const hasValidSelection = isClientSelectionValueValid(clients, value, { allowAll, allValue });
  const options = useMemo(() => filterClientOptions(clients, query, value, allowedStatuses), [allowedStatuses, clients, query, value]);
  const rows = useMemo(() => [
    ...(allowAll ? [{ kind: 'all', id: allValue, label: allLabel }] : []),
    ...options.map(client => ({ kind: 'client', id: String(client.id), client, label: clientIdentity(client) })),
    ...(onCreateClient ? [{ kind: 'create', id: '__create_client__', label: 'تسجيل عميل جديد' }] : []),
  ], [allLabel, allValue, allowAll, onCreateClient, options]);
  const visibleText = open ? query : isAll ? allLabel : selected ? clientIdentity(selected) : '';
  useImperativeHandle(forwardedRef, () => inputRef.current);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open, value]);

  useEffect(() => {
    inputRef.current?.setCustomValidity(required && !hasValidSelection ? 'اختر عميلًا من نتائج البحث.' : '');
  }, [hasValidSelection, required]);

  const choose = row => {
    if (!row) return;
    if (row.kind === 'create') {
      setOpen(false);
      setQuery('');
      onCreateClient?.();
      return;
    }
    onChange?.(row.kind === 'all' ? allValue : row.id, row.client || null);
    inputRef.current?.setCustomValidity('');
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
  };

  const onKeyDown = event => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(index => nextClientOptionIndex(index, event.key, rows.length));
      return;
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      choose(rows[activeIndex]);
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setQuery('');
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={rootRef} className={`client-combobox ${className}`.trim()} dir="rtl">
      <label htmlFor={id || `client-combobox-${generatedId}`}>{label}{required && <b aria-hidden="true"> *</b>}</label>
      <div className="client-combobox__control">
        <Search aria-hidden="true" />
        <input
          {...inputProps}
          ref={inputRef}
          id={id || `client-combobox-${generatedId}`}
          role="combobox"
          type="search"
          autoComplete="off"
          value={visibleText}
          placeholder={placeholder}
          required={required && !hasValidSelection}
          disabled={disabled}
          aria-expanded={open}
          aria-controls={`client-options-${generatedId}`}
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? `client-option-${generatedId}-${activeIndex}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onFocus={() => { setOpen(true); setActiveIndex(-1); }}
          onClick={() => setOpen(true)}
          onChange={event => {
            const nextValue = clientSelectionAfterQueryEdit(value, { allowAll, allValue });
            if (String(nextValue) !== String(value)) onChange?.(nextValue, null);
            if (required && !isAll) event.currentTarget.setCustomValidity('اختر عميلًا من نتائج البحث.');
            setQuery(event.target.value); setOpen(true); setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          onBlur={event => {
            if (rootRef.current?.contains(event.relatedTarget)) return;
            setOpen(false);
            setQuery('');
            setActiveIndex(-1);
          }}
        />
        {value && !required && (
          <button type="button" aria-label="مسح اختيار العميل" onClick={() => onChange?.(allowAll ? allValue : '', null)}>
            <X />
          </button>
        )}
      </div>
      {open && (
        <div id={`client-options-${generatedId}`} className="client-combobox__options" role="listbox">
          {rows.map((row, index) => (
            <button
              key={`${row.kind}-${row.id}`}
              id={`client-option-${generatedId}-${index}`}
              type="button"
              role="option"
              className={`${index === activeIndex ? 'is-active ' : ''}${row.kind === 'create' ? 'is-create' : ''}`.trim()}
              aria-selected={row.kind === 'all' ? isAll : row.kind === 'client' && String(row.id) === String(value)}
              onMouseDown={event => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(row)}
            >
              {row.kind === 'create' ? <UserPlus aria-hidden="true" /> : <span className="client-combobox__avatar" aria-hidden="true">{row.client?.name?.trim()?.[0] || 'ك'}</span>}
              <span>
                <strong>{row.kind === 'client' ? row.client.name : row.label}</strong>
                {row.kind === 'client' && (row.client.phone1 || row.client.phone || row.client.phone2) && <small dir="ltr">{row.client.phone1 || row.client.phone || row.client.phone2}</small>}
              </span>
              {(row.kind === 'all' ? isAll : row.kind === 'client' && String(row.id) === String(value)) && <Check aria-hidden="true" />}
            </button>
          ))}
          {!rows.length && <p className="client-combobox__empty">لا يوجد عميل مطابق للبحث.</p>}
        </div>
      )}
    </div>
  );
});

export default ClientCombobox;
