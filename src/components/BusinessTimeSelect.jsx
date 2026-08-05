import { createBusinessTimeOptions } from '../lib/businessFormat';

const BusinessTimeSelect = ({ min, max, step = 15, value, ...props }) => {
  const options = createBusinessTimeOptions({ min, max, step });
  return (
    <select value={value || ''} {...props}>
      {props.required === false && <option value="">—</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
};

export default BusinessTimeSelect;
