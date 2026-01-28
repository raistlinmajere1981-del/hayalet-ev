/**
 * Input Utilities
 * Input value management, auto-resize, focus
 */

function autoResize(inputEl: HTMLTextAreaElement | null, maxHeight: number = 300) {
  if (!inputEl) return;

  inputEl.style.height = 'auto';

  const scrollHeight = inputEl.scrollHeight;

  if (scrollHeight > maxHeight) {
    inputEl.style.height = `${maxHeight}px`;
    inputEl.style.overflowY = 'auto';
  } else {
    inputEl.style.height = `${scrollHeight}px`;
    inputEl.style.overflowY = 'hidden';
  }
}

function getValue(inputEl: HTMLTextAreaElement | null): string {
  return inputEl?.value.trim() || '';
}

function setValue(inputEl: HTMLTextAreaElement | null, value: string, autoResizeFn: () => void) {
  if (inputEl) {
    inputEl.value = value;
    autoResizeFn();
  }
}

function focus(inputEl: HTMLTextAreaElement | null) {
  inputEl?.focus();
}

export { autoResize, getValue, setValue, focus };
