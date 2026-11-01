export const $ = (id) => document.getElementById(id);
export const all = (selector) => [...document.querySelectorAll(selector)];
export const show = (id, visible) => $(id).classList.toggle('hidden', !visible);
export function loadPreferences() {
  try {
    const p = JSON.parse(localStorage.getItem('rally-preferences'));
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}
export function savePreferences(value) {
  try {
    localStorage.setItem('rally-preferences', JSON.stringify(value));
  } catch {
    /* Private browsing may disallow storage. */
  }
}
