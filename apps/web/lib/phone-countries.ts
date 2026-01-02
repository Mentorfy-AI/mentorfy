/**
 * Country data for phone input
 * Uses libphonenumber-js for dial codes and i18n-iso-countries for names
 * Flags are generated from ISO codes using regional indicator symbols
 */

import { getCountries, getCountryCallingCode, CountryCode } from 'libphonenumber-js';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

// Register English locale
countries.registerLocale(enLocale);

export interface Country {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
}

/**
 * Convert ISO country code to flag emoji
 * Uses regional indicator symbols: A=🇦, B=🇧, etc.
 */
function countryCodeToFlag(code: string): string {
  const codePoints = code
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Get all countries supported by libphonenumber-js with their metadata
 * Sorted alphabetically by name, with US at the top for convenience
 */
export function getPhoneCountries(): Country[] {
  const allCountries = getCountries()
    .map(code => {
      const name = countries.getName(code, 'en') || code;
      let dialCode: string;
      try {
        dialCode = `+${getCountryCallingCode(code)}`;
      } catch {
        return null; // Skip countries without dial codes
      }
      return {
        code,
        name,
        dialCode,
        flag: countryCodeToFlag(code),
      };
    })
    .filter((c): c is Country => c !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Move US to the top for convenience (most common)
  const usIndex = allCountries.findIndex(c => c.code === 'US');
  if (usIndex > 0) {
    const [us] = allCountries.splice(usIndex, 1);
    allCountries.unshift(us);
  }

  return allCountries;
}

// Cache the result since it never changes
let cachedCountries: Country[] | null = null;

export function getCountryList(): Country[] {
  if (!cachedCountries) {
    cachedCountries = getPhoneCountries();
  }
  return cachedCountries;
}

/**
 * Find a country by its dial code
 * Returns the first match (some countries share dial codes, e.g., US/Canada +1)
 */
export function findCountryByDialCode(dialCode: string): Country | undefined {
  return getCountryList().find(c => c.dialCode === dialCode);
}

/**
 * Find a country by its ISO code
 */
export function findCountryByCode(code: string): Country | undefined {
  return getCountryList().find(c => c.code === code);
}
