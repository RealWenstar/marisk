// i18n.js
// Handles multilingual support by loading locale files and applying translations.

document.addEventListener('DOMContentLoaded', () => {
  const langSelect = document.getElementById('lang-select');
  // Determine initial language from localStorage or default to English
  const storedLang = localStorage.getItem('language') || 'en';
  langSelect.value = storedLang;
  // Load and apply translations
  loadAndApplyTranslations(storedLang);

  // Listen for language changes
  langSelect.addEventListener('change', (e) => {
    const lang = e.target.value;
    localStorage.setItem('language', lang);
    loadAndApplyTranslations(lang);
  });
});

/**
 * Fetches translation JSON for a given language and applies the translations to
 * all elements with data-i18n and data-i18n-placeholder attributes.
 * @param {string} lang - The language code (e.g. "en", "fr").
 */
async function loadAndApplyTranslations(lang) {
  try {
    const res = await fetch(`/api/locales/${lang}`);
    if (!res.ok) throw new Error('Failed to load locale');
    const translations = await res.json();
    applyTranslations(translations);
  } catch (err) {
    console.error('Translation load error:', err);
  }
}

/**
 * Applies translations to DOM elements.
 * Elements with a data-i18n attribute will have their text content replaced with
 * the corresponding translation. Elements with a data-i18n-placeholder
 * attribute will have their placeholder attribute set.
 * @param {Object} translations - Object mapping keys to translated strings.
 */
function applyTranslations(translations) {
  // Update text content
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations && translations[key]) {
      el.textContent = translations[key];
    }
  });
  // Update placeholder attributes
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations && translations[key]) {
      el.setAttribute('placeholder', translations[key]);
    }
  });
}