import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Question,
  AnswerValue,
  ShortTextQuestion,
  LongTextQuestion,
  EmailQuestion,
  PhoneQuestion,
  NumberInputQuestion,
  MultipleChoiceQuestion,
  LikertScaleQuestion,
  InformationalQuestion,
} from '@/lib/forms/types';
import { Check, ChevronDown, Search, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { useFormTheme } from '@/lib/forms/theme';
import {
  parsePhoneNumberFromString,
  AsYouType,
  CountryCode,
} from 'libphonenumber-js';
import { getCountryList, Country } from '@/lib/phone-countries';

interface InputProps<T extends Question> {
  question: T;
  value: AnswerValue;
  onChange: (val: AnswerValue) => void;
  onEnter: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  hideLabel?: boolean;
}

// --- Short Text ---
export const ShortTextInput: React.FC<InputProps<ShortTextQuestion>> = ({
  question,
  value,
  onChange,
  onEnter,
  onBlur,
  autoFocus,
  hideLabel,
}) => {
  const theme = useFormTheme();
  const val = (value as string) || '';
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative w-full">
      {!hideLabel && (
        <label
          className="block text-sm font-medium mb-1"
          style={{ color: theme.textLabel }}
        >
          {question.text}
          {question.required && (
            <span style={{ color: theme.textLabel }}>*</span>
          )}
        </label>
      )}

      <input
        type="text"
        value={val}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          onBlur?.();
        }}
        maxLength={question.maxLength}
        className="w-full bg-transparent border-b py-2 text-xl font-medium focus:outline-none transition-colors placeholder:opacity-30"
        style={{
          borderColor: isFocused ? theme.primary : theme.primaryLight50,
          color: theme.primary,
          fontFamily: theme.fontBody,
        }}
        autoFocus={autoFocus}
      />
    </div>
  );
};

// --- Email ---
export const EmailInput: React.FC<InputProps<EmailQuestion>> = ({
  question,
  value,
  onChange,
  onEnter,
  onBlur,
  autoFocus,
  hideLabel,
}) => {
  const theme = useFormTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative w-full">
      {!hideLabel && (
        <label
          className="block text-sm font-medium mb-1"
          style={{ color: theme.textLabel }}
        >
          Email
          {question.required && (
            <span style={{ color: theme.textLabel }}>*</span>
          )}
        </label>
      )}

      <input
        type="email"
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          onBlur?.();
        }}
        className="w-full bg-transparent border-b py-2 text-xl font-medium focus:outline-none transition-colors placeholder:opacity-30"
        style={{
          borderColor: isFocused ? theme.primary : theme.primaryLight50,
          color: theme.primary,
          fontFamily: theme.fontBody,
        }}
        autoFocus={autoFocus}
      />
    </div>
  );
};

// --- Phone ---
export const PhoneInput: React.FC<InputProps<PhoneQuestion>> = ({
  question,
  value,
  onChange,
  onEnter,
  onBlur,
  autoFocus,
  hideLabel,
}) => {
  const theme = useFormTheme();
  const countries = useMemo(() => getCountryList(), []);
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]); // Default to US
  const [localNumber, setLocalNumber] = useState('');
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!searchQuery) return countries;
    const query = searchQuery.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.dialCode.includes(query) ||
        c.code.toLowerCase().includes(query)
    );
  }, [countries, searchQuery]);

  // Initialize from existing value (for backwards compat with E.164 numbers)
  useEffect(() => {
    const val = value as string;
    if (val && val.startsWith('+')) {
      const parsed = parsePhoneNumberFromString(val);
      if (parsed) {
        const country = countries.find((c) => c.code === parsed.country);
        if (country) {
          setSelectedCountry(country);
          setLocalNumber(parsed.nationalNumber);
          setDisplayValue(parsed.formatNational());
        }
      }
    }
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isDropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
        setSearchQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle phone input change
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target.value;
    const digits = input.replace(/\D/g, '');

    // Format with selected country
    const formatter = new AsYouType(selectedCountry.code as CountryCode);
    const formatted = formatter.input(digits);

    setLocalNumber(digits);
    setDisplayValue(formatted);

    // Store full E.164 format
    const fullNumber = `${selectedCountry.dialCode}${digits}`;
    const parsed = parsePhoneNumberFromString(
      fullNumber,
      selectedCountry.code as CountryCode
    );

    if (parsed && parsed.isValid()) {
      onChange(parsed.format('E.164'));
    } else {
      onChange(digits ? `${selectedCountry.dialCode}${digits}` : '');
    }
  }

  function handleCountrySelect(country: Country) {
    setSelectedCountry(country);
    setIsDropdownOpen(false);
    setSearchQuery('');

    // Reformat and update stored value with new country code
    if (localNumber) {
      const fullNumber = `${country.dialCode}${localNumber}`;
      const parsed = parsePhoneNumberFromString(
        fullNumber,
        country.code as CountryCode
      );

      if (parsed) {
        setDisplayValue(parsed.formatNational());
        onChange(parsed.format('E.164'));
      } else {
        onChange(`${country.dialCode}${localNumber}`);
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      onEnter();
    }
  }

  return (
    <div className="relative w-full">
      {!hideLabel && (
        <label
          className="block text-sm font-medium mb-1"
          style={{ color: theme.textLabel }}
        >
          Phone
          {question.required && (
            <span style={{ color: theme.textLabel }}>*</span>
          )}
        </label>
      )}

      {/* Phone Input Container */}
      <div
        className="relative flex items-center border-b transition-colors"
        style={{
          borderColor: isFocused ? theme.primary : theme.primaryLight50,
        }}
      >
        {/* Country Code Selector */}
        <div
          className="relative"
          ref={dropdownRef}
        >
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1 py-2 pr-2 hover:opacity-80 transition-opacity"
            style={{ color: theme.primary }}
          >
            <span className="text-xl">{selectedCountry.flag}</span>
            <span
              className="text-lg font-medium"
              style={{ fontFamily: theme.fontBody }}
            >
              {selectedCountry.dialCode}
            </span>
            <ChevronDown size={16} />
          </button>

          {/* Dropdown - opens upward to avoid being cut off */}
          {isDropdownOpen && (
            <div
              className="absolute bottom-full left-0 mb-1 w-72 rounded-lg shadow-lg border z-50 flex flex-col"
              style={{
                backgroundColor: theme.bgContainer,
                borderColor: theme.primaryLight20,
                maxHeight: '280px',
              }}
            >
              {/* Search input */}
              <div
                className="sticky top-0 p-2 border-b"
                style={{
                  backgroundColor: theme.bgContainer,
                  borderColor: theme.primaryLight20,
                }}
              >
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-2 top-1/2 -translate-y-1/2 opacity-40"
                    style={{ color: theme.primary }}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search countries..."
                    className="w-full pl-8 pr-3 py-1.5 text-sm rounded border focus:outline-none"
                    style={{
                      backgroundColor: theme.primaryLight5,
                      borderColor: theme.primaryLight20,
                      color: theme.primary,
                    }}
                    onKeyDown={(e) => {
                      // Prevent form submission when pressing enter in search
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (filteredCountries.length > 0) {
                          handleCountrySelect(filteredCountries[0]);
                        }
                      }
                    }}
                  />
                </div>
              </div>

              {/* Country list */}
              <div className="overflow-y-auto flex-1">
                {filteredCountries.length === 0 ? (
                  <div
                    className="px-3 py-4 text-sm text-center opacity-60"
                    style={{ color: theme.primary }}
                  >
                    No countries found
                  </div>
                ) : (
                  filteredCountries.map((country) => (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => handleCountrySelect(country)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-opacity-10 transition-colors text-left"
                      style={{
                        backgroundColor:
                          selectedCountry.code === country.code
                            ? theme.primaryLight10
                            : 'transparent',
                        color: theme.primary,
                      }}
                    >
                      <span className="text-lg">{country.flag}</span>
                      <span className="flex-1 text-sm truncate">
                        {country.name}
                      </span>
                      <span
                        className="text-sm opacity-60 flex-shrink-0"
                        style={{ fontFamily: theme.fontBody }}
                      >
                        {country.dialCode}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div
          className="h-6 w-px"
          style={{ backgroundColor: theme.primaryLight20 }}
        />

        {/* Phone Number Input */}
        <input
          type="tel"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          // placeholder="Phone number"
          className="flex-1 bg-transparent py-2 px-2 text-lg font-medium focus:outline-none placeholder:opacity-30 min-w-0"
          style={{
            color: theme.primary,
            fontFamily: theme.fontBody,
          }}
          autoFocus={autoFocus}
        />
      </div>
    </div>
  );
};

// --- Long Text ---
export const LongTextInput: React.FC<InputProps<LongTextQuestion>> = ({
  question,
  value,
  onChange,
  onBlur,
  autoFocus,
  hideLabel,
}) => {
  const theme = useFormTheme();
  const val = (value as string) || '';
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="w-full relative">
      {!hideLabel && (
        <label
          className="block text-sm font-medium mb-2"
          style={{ color: theme.textLabel }}
        >
          Your answer
          {question.required && (
            <span style={{ color: theme.textLabel }}>*</span>
          )}
        </label>
      )}

      <textarea
        value={val}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          onBlur?.();
        }}
        maxLength={question.maxLength}
        className="w-full bg-transparent border rounded-sm shadow-sm py-2 text-xl font-medium focus:outline-none resize-none min-h-[150px] leading-relaxed transition-colors placeholder:opacity-30"
        style={{
          borderColor: isFocused ? theme.primary : theme.primaryLight50,
          color: theme.primary,
          fontFamily: theme.fontBody,
        }}
        autoFocus={autoFocus}
      />
    </div>
  );
};

// --- Number ---
export const NumberInput: React.FC<InputProps<NumberInputQuestion>> = ({
  question,
  value,
  onChange,
  onEnter,
  onBlur,
  autoFocus,
  hideLabel,
}) => {
  const theme = useFormTheme();
  const hasPrefix = !!question.prefix;
  const hasSuffix = !!question.suffix;
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className="relative w-full max-w-[300px]">
      {!hideLabel && (
        <label
          className="block text-sm font-medium mb-1"
          style={{ color: theme.textLabel }}
        >
          {question.prefix ? 'Amount' : 'Number'}
          {question.required && (
            <span style={{ color: theme.textLabel }}>*</span>
          )}
        </label>
      )}

      <div
        className="flex items-end border-b transition-colors"
        style={{
          borderColor: isFocused ? theme.primary : theme.primaryLight50,
        }}
      >
        {hasPrefix && (
          <span
            className="text-2xl font-medium mr-2 mb-2"
            style={{
              color: theme.primary,
              fontFamily: theme.fontBody,
            }}
          >
            {question.prefix}
          </span>
        )}

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={(value as string | number) || ''}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '' || /^\d+\.?\d*$/.test(val)) {
              onChange(val === '' ? '' : Number(val));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
            }
            if (e.key === 'Enter') onEnter();
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
          className="w-full bg-transparent py-2 text-2xl font-medium focus:outline-none placeholder:opacity-30"
          style={{
            color: theme.primary,
            fontFamily: theme.fontBody,
          }}
          autoFocus={autoFocus}
        />

        {hasSuffix && (
          <span
            className="text-lg font-medium ml-2 mb-2"
            style={{ color: theme.primary }}
          >
            {question.suffix}
          </span>
        )}
      </div>
    </div>
  );
};

// --- Multiple Choice ---
export const MultipleChoiceInput: React.FC<
  InputProps<MultipleChoiceQuestion>
> = ({ question, value, onChange }) => {
  const theme = useFormTheme();
  const isMultiSelect = (question.maxSelections || 1) > 1;
  const selectedValues = Array.isArray(value)
    ? value
    : value
    ? [value as string]
    : [];

  const handleSelect = (option: string) => {
    if (isMultiSelect) {
      const newValues = selectedValues.includes(option)
        ? selectedValues.filter((v) => v !== option)
        : [...selectedValues, option];

      if (question.maxSelections && newValues.length > question.maxSelections)
        return;

      onChange(newValues);
    } else {
      onChange(option);
    }
  };

  const getLetter = (index: number) => String.fromCharCode(65 + index);

  // Dynamic sizing based on number of options
  const optionCount = question.options?.length || 0;
  const getCompactStyles = () => {
    if (optionCount >= 7) {
      return {
        gap: 'gap-1.5',
        padding: 'p-1.5',
        fontSize: 'text-sm',
        letterBox: 'w-8 h-8 text-xs',
        letterMargin: 'mr-3',
        checkSize: 16,
      };
    } else if (optionCount >= 5) {
      return {
        gap: 'gap-2',
        padding: 'p-2',
        fontSize: 'text-base',
        letterBox: 'w-9 h-9 text-sm',
        letterMargin: 'mr-3',
        checkSize: 18,
      };
    }
    // Default (4 or fewer)
    return {
      gap: 'gap-3',
      padding: 'p-2',
      fontSize: 'text-lg',
      letterBox: 'w-10 h-10 text-sm',
      letterMargin: 'mr-4',
      checkSize: 20,
    };
  };

  const styles = getCompactStyles();

  return (
    <div className={`flex flex-col ${styles.gap} w-full`}>
      {question.options?.map((option, idx) => {
        const isSelected = selectedValues.includes(option);
        const letter = getLetter(idx);

        return (
          <button
            key={option}
            onClick={() => handleSelect(option)}
            className={`group relative flex items-center w-full ${styles.padding} rounded-lg border transition-all duration-200`}
            style={{
              backgroundColor: isSelected
                ? theme.primaryLight10
                : theme.primaryLight5,
              borderColor: isSelected ? theme.primary : theme.primaryLight20,
              boxShadow: isSelected
                ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                : 'none',
            }}
          >
            {/* Letter Box */}
            <div
              className={`${styles.letterBox} rounded flex items-center justify-center font-bold ${styles.letterMargin} transition-colors shrink-0`}
              style={{
                backgroundColor: isSelected ? theme.primary : theme.bgContainer,
                color: isSelected ? theme.bgContainer : theme.primary,
                borderWidth: isSelected ? '0' : '1px',
                borderColor: theme.primaryLight20,
              }}
            >
              {letter}
            </div>

            {/* Text */}
            <span
              className={`${styles.fontSize} font-medium flex-1 text-left`}
              style={{
                color: isSelected ? theme.primary : theme.primaryLight80,
              }}
            >
              {option}
            </span>

            {/* Checkmark for selected state */}
            {isSelected && (
              <div
                className="mr-2"
                style={{ color: theme.primary }}
              >
                <Check size={styles.checkSize} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

// --- Likert Scale ---
export const LikertScaleInput: React.FC<InputProps<LikertScaleQuestion>> = ({
  question,
  value,
  onChange,
}) => {
  const theme = useFormTheme();
  const options = question.options;
  const selectedIndex = typeof value === 'string' ? options.indexOf(value) : -1;

  return (
    <div className="w-full py-4">
      {/* Desktop: Horizontal Track */}
      <div className="hidden md:flex justify-between items-center relative gap-2 mt-8 mb-20">
        <div
          className="absolute top-1/2 left-0 w-full h-1 -z-10 rounded-full"
          style={{ backgroundColor: theme.borderInput }}
        />

        {options.map((opt, idx) => {
          const isSelected = selectedIndex === idx;
          return (
            <div
              key={idx}
              className="relative flex flex-col items-center group"
            >
              <button
                onClick={() => onChange(opt)}
                className="w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 shadow-sm z-10"
                style={{
                  backgroundColor: isSelected
                    ? theme.primary
                    : theme.bgContainer,
                  borderColor: isSelected ? theme.primary : theme.borderInput,
                  transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                {/* Inner dot */}
                <div
                  className="w-3 h-3 rounded-full transition-colors"
                  style={{
                    backgroundColor: isSelected
                      ? theme.bgContainer
                      : theme.primaryLight20,
                  }}
                />
              </button>

              {/* Label below node */}
              <div
                className="absolute top-16 w-32 text-center text-xs font-medium transition-colors duration-300"
                style={{
                  color: isSelected ? theme.primary : theme.textSubtle,
                }}
              >
                {opt}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile: Vertical Stack - Match multiple choice style */}
      <div className="flex md:hidden flex-col gap-2">
        {options.map((opt, idx) => {
          const isSelected = selectedIndex === idx;
          const letter = String.fromCharCode(65 + idx);

          return (
            <button
              key={idx}
              onClick={() => onChange(opt)}
              className="group relative flex items-center w-full p-1.5 rounded-lg border transition-all duration-200"
              style={{
                backgroundColor: isSelected
                  ? theme.primaryLight10
                  : theme.primaryLight5,
                borderColor: isSelected ? theme.primary : theme.primaryLight20,
                boxShadow: isSelected
                  ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                  : 'none',
              }}
            >
              {/* Letter Box */}
              <div
                className="w-9 h-9 rounded flex items-center justify-center font-bold text-sm mr-3 transition-colors shrink-0"
                style={{
                  backgroundColor: isSelected
                    ? theme.primary
                    : theme.bgContainer,
                  color: isSelected ? theme.bgContainer : theme.primary,
                  borderWidth: isSelected ? '0' : '1px',
                  borderColor: theme.primaryLight20,
                }}
              >
                {letter}
              </div>

              {/* Text */}
              <span
                className="text-base font-medium flex-1 min-w-0"
                style={{
                  color: isSelected ? theme.primary : theme.primaryLight80,
                }}
              >
                {opt}
              </span>

              {/* Checkmark - always reserve space */}
              <div
                className="mr-2 w-[18px] h-[18px] flex items-center justify-center shrink-0"
                style={{ color: theme.primary }}
              >
                {isSelected && <Check size={18} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- Informational Display (Static) ---
interface InformationalDisplayProps {
  question: InformationalQuestion;
  generatedContent?: string;
  isLoading?: boolean;
  botAvatarUrl?: string;
  botDisplayName?: string;
}

export const InformationalDisplay: React.FC<InformationalDisplayProps> = ({
  question,
  generatedContent,
  isLoading,
}) => {
  // Route to LLM display for LLM content
  if (question.contentSource === 'llm') {
    return (
      <InformationalLLMDisplay
        question={question}
        generatedContent={generatedContent}
        isLoading={isLoading}
      />
    );
  }

  // Static content - use same typewriter component
  return (
    <InformationalLLMDisplay
      question={question}
      generatedContent={question.content}
      isLoading={false}
    />
  );
};

// --- Informational Display (LLM with Avatar + Typewriter) ---
interface InformationalLLMDisplayProps {
  question: InformationalQuestion;
  generatedContent?: string;
  isLoading?: boolean;
  botAvatarUrl?: string;
  botDisplayName?: string;
}

export const InformationalLLMDisplay: React.FC<InformationalLLMDisplayProps> = ({
  generatedContent,
  isLoading,
}) => {
  const theme = useFormTheme();
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Typewriter effect
  useEffect(() => {
    // Clear any existing interval
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }

    // Reset when content changes or loading starts
    if (isLoading || !generatedContent) {
      setDisplayedText('');
      setIsTyping(false);
      return;
    }

    // Start typewriter effect
    setIsTyping(true);
    let charIndex = 0;

    typingIntervalRef.current = setInterval(() => {
      if (charIndex < generatedContent.length) {
        setDisplayedText(generatedContent.slice(0, charIndex + 1));
        charIndex++;
      } else {
        if (typingIntervalRef.current) {
          clearInterval(typingIntervalRef.current);
          typingIntervalRef.current = null;
        }
        setIsTyping(false);
      }
    }, 20); // Fast and snappy ~20ms per character

    return () => {
      if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
      }
    };
  }, [generatedContent, isLoading]);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Content area - just typewriter text */}
      <div
        className="text-xl font-medium leading-relaxed text-center w-full whitespace-pre-line"
        style={{ color: theme.primary }}
      >
        {isLoading ? (
          <span className="opacity-50">Thinking...</span>
        ) : (
          <>
            {displayedText}
            {isTyping && (
              <span
                className="inline-block w-0.5 h-5 ml-0.5 animate-blink"
                style={{ backgroundColor: theme.primary }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
