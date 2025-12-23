import { useState, useEffect, useRef } from 'react';

interface InlineEditCellProps {
  value: string;
  onSave: (newValue: string) => void;
  onCancel: () => void;
  isEditing: boolean;
  setIsEditing: (editing: boolean) => void;
}

function InlineEditCell({ value, onSave, onCancel, isEditing, setIsEditing }: InlineEditCellProps) {
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value);
    onCancel();
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleClick = () => {
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full p-2 text-lg border-2 border-brand-500 rounded-lg focus:outline-none focus:ring-4 focus:ring-brand-100"
      />
    );
  }

  return (
    <span
      onClick={handleClick}
      className="cursor-pointer px-2 py-1 rounded-lg inline-block w-full hover:bg-neutral-100"
    >
      {value || 'Unknown'}
    </span>
  );
}

export default InlineEditCell;
