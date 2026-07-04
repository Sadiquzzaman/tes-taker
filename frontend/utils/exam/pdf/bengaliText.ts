/** Bengali Unicode block: U+0980 – U+09FF */
const BENGALI_SCRIPT_RE = /[\u0980-\u09FF]/;

export const containsBengaliScript = (text: string): boolean => BENGALI_SCRIPT_RE.test(text);
