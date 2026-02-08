'use client';

import { useState, useCallback, useMemo } from 'react';
import { ArrowUp, Check } from 'lucide-react';
import type { FormField } from '../types';

// ─── Props ──────────────────────────────────────────────────────────────

interface QuestionFormProps {
  content: string;
  fields: FormField[];
  onSubmit: (answers: Record<string, string | string[]>) => void;
}

// ─── Sub-components ─────────────────────────────────────────────────────

function TextFieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-[var(--an-text-secondary)]">
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {field.description && (
        <p className="text-[10px] text-[var(--an-text-dim)]">{field.description}</p>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || ''}
        className="w-full px-2.5 py-1.5 bg-[var(--an-bg-card)] border border-[var(--an-border-input)] text-[13px] text-[var(--an-text)] rounded-lg outline-none focus:border-[var(--an-accent)] transition-colors"
      />
    </div>
  );
}

function RadioSelect({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-[var(--an-text-secondary)]">
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {field.description && (
        <p className="text-[10px] text-[var(--an-text-dim)]">{field.description}</p>
      )}
      <div className="space-y-1">
        {(field.options || []).map((opt) => {
          const isSelected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                isSelected
                  ? 'bg-[var(--an-accent-bg)] border border-[var(--an-accent)]'
                  : 'bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)] hover:border-[var(--an-border-hover)]'
              }`}
            >
              <div className="text-left space-y-0.5 flex-1">
                <div className="text-[11px] font-semibold text-[var(--an-text-secondary)]">{opt.label}</div>
                {opt.description && (
                  <div className="text-[10px] text-[var(--an-text-dim)]">{opt.description}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CheckboxSelect({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string[];
  onChange: (val: string[]) => void;
}) {
  const toggle = (optId: string) => {
    if (value.includes(optId)) {
      onChange(value.filter((v) => v !== optId));
    } else {
      onChange([...value, optId]);
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-[var(--an-text-secondary)]">
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {field.description && (
        <p className="text-[10px] text-[var(--an-text-dim)]">{field.description}</p>
      )}
      <div className="space-y-1">
        {(field.options || []).map((opt) => {
          const isSelected = value.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
                isSelected
                  ? 'bg-[var(--an-accent-bg)] border border-[var(--an-accent)]'
                  : 'bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)] hover:border-[var(--an-border-hover)]'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded flex-shrink-0 flex items-center justify-center border transition-colors ${
                  isSelected
                    ? 'bg-[var(--an-accent)] border-[var(--an-accent)]'
                    : 'bg-transparent border-[var(--an-border-hover)]'
                }`}
              >
                {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <div className="text-left space-y-0.5 flex-1">
                <div className="text-[11px] font-semibold text-[var(--an-text-secondary)]">{opt.label}</div>
                {opt.description && (
                  <div className="text-[10px] text-[var(--an-text-dim)]">{opt.description}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────

export function QuestionForm({ content, fields, onSubmit }: QuestionFormProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(() => {
    const init: Record<string, string | string[]> = {};
    for (const field of fields) {
      if (field.defaultValue !== undefined) {
        init[field.id] = field.defaultValue;
      } else if (field.type === 'multi_select') {
        init[field.id] = [];
      } else {
        init[field.id] = '';
      }
    }
    return init;
  });

  const updateField = useCallback((fieldId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const isValid = useMemo(() => {
    return fields.every((field) => {
      if (!field.required) return true;
      const val = answers[field.id];
      if (Array.isArray(val)) return val.length > 0;
      return typeof val === 'string' && val.trim().length > 0;
    });
  }, [fields, answers]);

  const handleSubmit = useCallback(() => {
    if (!isValid) return;
    onSubmit(answers);
  }, [isValid, answers, onSubmit]);

  return (
    <div className="bg-[var(--an-bg-elevated)] border border-[var(--an-border-input)] rounded-lg p-4 space-y-3">
      {content && (
        <p className="text-[12px] text-[var(--an-text-muted)]">{content}</p>
      )}

      {fields.map((field) => {
        if (field.type === 'text') {
          return (
            <TextFieldInput
              key={field.id}
              field={field}
              value={(answers[field.id] as string) || ''}
              onChange={(val) => updateField(field.id, val)}
            />
          );
        }
        if (field.type === 'select') {
          return (
            <RadioSelect
              key={field.id}
              field={field}
              value={(answers[field.id] as string) || ''}
              onChange={(val) => updateField(field.id, val)}
            />
          );
        }
        if (field.type === 'multi_select') {
          return (
            <CheckboxSelect
              key={field.id}
              field={field}
              value={(answers[field.id] as string[]) || []}
              onChange={(val) => updateField(field.id, val)}
            />
          );
        }
        return null;
      })}

      <div className="flex justify-end pt-1">
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--an-accent)] text-white text-[11px] font-medium hover:bg-[var(--an-accent-hover)] transition-colors disabled:opacity-50"
        >
          <ArrowUp className="w-3 h-3" />
          Continue
        </button>
      </div>
    </div>
  );
}
