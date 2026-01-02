
import React from 'react';
import { motion } from 'framer-motion';
import { 
  Question, 
  AnswerValue, 
  ShortTextQuestion, 
  LongTextQuestion, 
  EmailQuestion, 
  NumberInputQuestion, 
  MultipleChoiceQuestion, 
  LikertScaleQuestion 
} from '../types';
import { Check, Mail, Hash } from 'lucide-react';
import clsx from 'clsx';

interface InputProps<T extends Question> {
  question: T;
  value: AnswerValue;
  onChange: (val: AnswerValue) => void;
  onEnter: () => void;
}

// --- Short Text ---
export const ShortTextInput: React.FC<InputProps<ShortTextQuestion>> = ({ question, value, onChange, onEnter }) => {
  const val = (value as string) || '';
  
  return (
    <div className="relative w-full">
      <input
        type="text"
        value={val}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        placeholder={question.placeholder}
        maxLength={question.maxLength}
        className="w-full bg-transparent border-b-2 border-slate-200 py-4 text-2xl md:text-3xl text-slate-800 placeholder-slate-300 focus:outline-none focus:border-brand-500 transition-colors font-light"
        autoFocus
      />
      {question.maxLength && (
        <div className="absolute right-0 bottom-[-24px] text-xs text-slate-400 font-mono">
          {val.length} / {question.maxLength}
        </div>
      )}
    </div>
  );
};

// --- Email ---
export const EmailInput: React.FC<InputProps<EmailQuestion>> = ({ question, value, onChange, onEnter }) => {
  return (
    <div className="relative w-full flex items-center">
      <Mail className="absolute left-0 text-slate-400 w-5 h-5 md:w-6 md:h-6" />
      <input
        type="email"
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        placeholder={question.placeholder}
        className="w-full bg-transparent border-b-2 border-slate-200 py-4 pl-8 md:pl-10 text-2xl md:text-3xl text-slate-800 placeholder-slate-300 focus:outline-none focus:border-brand-500 transition-colors font-light"
        autoFocus
      />
    </div>
  );
};

// --- Long Text ---
export const LongTextInput: React.FC<InputProps<LongTextQuestion>> = ({ question, value, onChange }) => {
  const val = (value as string) || '';
  
  return (
    <div className="w-full relative">
      <textarea
        value={val}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.placeholder}
        maxLength={question.maxLength}
        className="w-full bg-white/50 backdrop-blur-sm rounded-xl border-2 border-slate-100 p-4 md:p-6 text-lg md:text-xl text-slate-800 placeholder-slate-300 focus:outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 transition-all resize-none min-h-[150px] md:min-h-[200px] shadow-sm"
        autoFocus
      />
      <div className="flex justify-between mt-2 text-slate-400 text-xs md:text-sm">
        <span className="hidden md:inline">Shift + Enter for new line</span>
        <span className="font-mono">
            {val.length} {question.maxLength ? `/ ${question.maxLength}` : 'chars'}
        </span>
      </div>
    </div>
  );
};

// --- Number ---
export const NumberInput: React.FC<InputProps<NumberInputQuestion>> = ({ question, value, onChange, onEnter }) => {
  const hasPrefix = !!question.prefix;
  const hasSuffix = !!question.suffix;

  return (
    <div className="relative w-full max-w-[300px]">
        {/* Decorative Icon if no prefix */}
      {!hasPrefix && <Hash className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 w-6 h-6 md:w-8 md:h-8" />}
      
      {hasPrefix && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 text-2xl md:text-3xl text-slate-400 font-light font-display">
              {question.prefix}
          </span>
      )}

      <input
        type="number"
        value={(value as string | number) || ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        placeholder={question.placeholder}
        min={question.min}
        max={question.max}
        step={question.step}
        className={clsx(
            "w-full bg-transparent border-b-2 border-slate-200 py-4 text-4xl md:text-5xl text-slate-800 placeholder-slate-200 focus:outline-none focus:border-brand-500 transition-colors font-light font-display",
            hasPrefix ? "pl-8 md:pl-10" : "pl-10 md:pl-12",
            hasSuffix && "pr-16"
        )}
        autoFocus
      />

      {hasSuffix && (
          <span className="absolute right-0 top-1/2 -translate-y-1/2 text-lg text-slate-400 font-medium">
              {question.suffix}
          </span>
      )}
    </div>
  );
};

// --- Multiple Choice ---
export const MultipleChoiceInput: React.FC<InputProps<MultipleChoiceQuestion>> = ({ question, value, onChange }) => {
  const isMultiSelect = (question.maxSelections || 1) > 1;
  const selectedValues = Array.isArray(value) ? value : (value ? [value as string] : []);

  const handleSelect = (option: string) => {
    if (isMultiSelect) {
      const newValues = selectedValues.includes(option)
        ? selectedValues.filter(v => v !== option)
        : [...selectedValues, option];
      
      // Simple limit check handled here or in validation
      if (question.maxSelections && newValues.length > question.maxSelections) return;
      
      onChange(newValues);
    } else {
      onChange(option); // Single string for single select
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {question.options?.map((option, idx) => {
        const isSelected = selectedValues.includes(option);
        
        return (
          <motion.button
            key={option}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => handleSelect(option)}
            className={clsx(
              "group relative flex items-center w-full p-4 md:p-5 rounded-xl border-2 transition-all text-left hover:shadow-md active:scale-[0.98]",
              isSelected 
                ? "border-brand-500 bg-brand-50 text-brand-900 shadow-brand-100" 
                : "border-slate-100 bg-white text-slate-600 hover:border-brand-200 hover:bg-slate-50"
            )}
          >
            {/* Icon Box: Circle for radio, Rounded Square for checkbox */}
            <div className={clsx(
              "w-5 h-5 md:w-6 md:h-6 border-2 mr-4 flex items-center justify-center transition-colors shrink-0",
              isMultiSelect ? "rounded-md" : "rounded-full", 
              isSelected ? "border-brand-500 bg-brand-500" : "border-slate-300 group-hover:border-brand-400"
            )}>
              {isSelected && <Check className="w-3 h-3 md:w-4 md:h-4 text-white" strokeWidth={4} />}
            </div>
            
            <span className="text-base md:text-lg font-medium">{option}</span>
            
            <span className={clsx(
              "hidden md:block absolute right-4 text-xs font-mono px-2 py-1 rounded opacity-0 transition-opacity",
               "text-slate-400 border border-slate-200 group-hover:opacity-100"
            )}>
              {String.fromCharCode(65 + idx)}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
};

// --- Likert Scale ---
export const LikertScaleInput: React.FC<InputProps<LikertScaleQuestion>> = ({ question, value, onChange }) => {
  const options = question.options;
  const selectedIndex = typeof value === 'string' ? options.indexOf(value) : -1;
  
  return (
    <div className="w-full py-4">
      <div className="mb-8 text-center md:text-left">
         <p className="text-xl md:text-2xl font-display font-medium text-slate-800 italic">"{question.statement}"</p>
      </div>

      {/* Desktop: Horizontal Track */}
      <div className="hidden md:flex justify-between items-center relative gap-2 mt-8">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -z-10 rounded-full" />
        
        {options.map((opt, idx) => {
          const isSelected = selectedIndex === idx;
          return (
            <div key={idx} className="relative flex flex-col items-center group">
                <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: idx * 0.05, type: "spring" }}
                onClick={() => onChange(opt)}
                className={clsx(
                    "w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 shadow-sm z-10",
                    isSelected 
                    ? "bg-brand-500 border-brand-500 text-white scale-110 shadow-lg shadow-brand-500/30" 
                    : "bg-white border-slate-200 hover:border-brand-300"
                )}
                >
                 {/* Inner dot for unselected hover state */}
                 <div className={clsx("w-3 h-3 rounded-full transition-colors", isSelected ? "bg-white" : "bg-slate-100 group-hover:bg-brand-200")} />
                </motion.button>
                
                {/* Label below node */}
                <div className={clsx(
                    "absolute top-16 w-24 text-center text-xs font-medium transition-all duration-300",
                    isSelected ? "text-brand-600 opacity-100 translate-y-0" : "text-slate-400 opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0"
                )}>
                    {opt}
                </div>
            </div>
          );
        })}
      </div>

      {/* Current Selection Text Display (Desktop) */}
      <div className="hidden md:block h-8 mt-2 text-center">
          {selectedIndex !== -1 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                key={selectedIndex}
                className="text-brand-600 font-medium"
              >
                  {options[selectedIndex]}
              </motion.div>
          )}
      </div>

      {/* Mobile: Vertical Stack */}
      <div className="flex md:hidden flex-col gap-3">
          {options.map((opt, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                  <button
                    key={idx}
                    onClick={() => onChange(opt)}
                    className={clsx(
                        "w-full p-4 rounded-xl border transition-colors text-left text-sm font-medium",
                        isSelected ? "bg-brand-50 border-brand-500 text-brand-700" : "bg-white border-slate-100 text-slate-600"
                    )}
                  >
                      {opt}
                  </button>
              )
          })}
      </div>
    </div>
  );
};
