import { useEffect, useState } from 'react';
import { MainWindow } from './windows/MainWindow';
import { CaptureWindow } from './windows/CaptureWindow';

type View = 'main' | 'capture';

/**
 * 根据 hash (#/main 或 #/capture) 决定渲染哪个窗口的内容
 */
export function App() {
  const [view, setView] = useState<View>(() => parseView(window.location.hash));

  useEffect(() => {
    const onHashChange = () => setView(parseView(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // 浏览器直接打开时不渲染 UI（避免 window.lumen undefined 导致白/黑屏）
  if (typeof window.lumen === 'undefined') {
    return <NotInElectronHint />;
  }

  return view === 'capture' ? <CaptureWindow /> : <MainWindow />;
}

function parseView(hash: string): View {
  if (hash.includes('capture')) return 'capture';
  return 'main';
}

function NotInElectronHint() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-bg">
      <div className="max-w-md text-center space-y-4 px-8">
        <div className="text-5xl">✦</div>
        <h1 className="text-2xl font-serif">Lumen · 灵犀</h1>
        <p className="text-fg-muted text-sm leading-relaxed">
          这是一个 Electron 桌面应用，不能在浏览器中直接运行。
        </p>
        <div className="text-xs text-fg-dim p-4 rounded-lg bg-bg-card border border-stroke text-left font-mono">
          请在终端运行：<br />
          <span className="text-accent">npm run dev</span>
        </div>
      </div>
    </div>
  );
}
