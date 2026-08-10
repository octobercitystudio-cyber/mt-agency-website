import { useRef, useState } from 'react';
import { Edit3, MoreVertical, ShieldAlert } from 'lucide-react';
import OwnerActionDialog from './OwnerActionDialog';
import { isOwner } from './ownerPermissions';
import './OwnerRecordActions.css';

export default function OwnerRecordActions({ user, entity, record, label, onEdit, onChanged, compact = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  if (!isOwner(user) || !record?.id) return null;
  return <>
    <div className={`owner-record-actions ${compact ? 'compact' : ''} ${className}`} aria-label={`تحكم المالك في ${label}`}>
      {onEdit && <button type="button" className="owner-edit" onClick={onEdit}><Edit3 /> تعديل</button>}
      <button ref={triggerRef} type="button" className="owner-impact" onClick={() => setOpen(true)}>{compact ? <MoreVertical aria-label="إجراء حذف أو أرشفة" /> : <><ShieldAlert /> حذف / أرشفة</>}</button>
    </div>
    {open && <OwnerActionDialog entity={entity} record={record} label={label} returnFocusRef={triggerRef} onClose={() => setOpen(false)} onChanged={onChanged} />}
  </>;
}
