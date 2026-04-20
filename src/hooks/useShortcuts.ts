import { useEffect } from 'react';

type Handler = (e: KeyboardEvent) => void;

/**
 * 应用内键盘快捷键绑定。
 * @param keyCombo 形如 'mod+k'、'mod+enter'、'esc'、'mod+shift+f'
 * @param handler
 * @param deps
 */
export function useShortcut(keyCombo: string, handler: Handler, deps: any[] = []) {
  useEffect(() => {
    const parts = keyCombo.toLowerCase().split('+').map(s => s.trim());
    const needsMod = parts.includes('mod') || parts.includes('ctrl') || parts.includes('cmd');
    const needsShift = parts.includes('shift');
    const needsAlt = parts.includes('alt');
    const key = parts.filter(p => !['mod', 'ctrl', 'cmd', 'shift', 'alt'].includes(p))[0] || '';

    const listener = (e: KeyboardEvent) => {
      const modOk = !needsMod || e.ctrlKey || e.metaKey;
      const shiftOk = needsShift ? e.shiftKey : true;
      const altOk = needsAlt ? e.altKey : true;
      if (!modOk || !shiftOk || !altOk) return;
      if (key && e.key.toLowerCase() !== key) return;
      handler(e);
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
