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
        style={{
          width: '100%',
          padding: '4px',
          border: '1px solid #007bff',
          borderRadius: '3px',
          fontSize: '14px',
        }}
      />
    );
  }

  return (
    <span
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        padding: '4px',
        borderRadius: '3px',
        display: 'inline-block',
        width: '100%',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#f8f9fa';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {value || 'Unknown'}
    </span>
  );
}

export default InlineEditCell;
