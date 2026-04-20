import { useCallback, useEffect, useState } from 'react';
import { lumen } from '../lib/api';
import type { AIConfig } from '../types';

export function useSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [aiConfig, setAIConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const s = await lumen().settings.all();
    setSettings(s);
    setAIConfig(s['ai.config'] as AIConfig);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const set = useCallback(async (key: string, value: any) => {
    await lumen().settings.set(key, value);
    await reload();
  }, [reload]);

  const saveAIConfig = useCallback(async (partial: Partial<{ apiKey: string; baseUrl: string; chatModel: string; embedModel: string }>) => {
    await lumen().ai.saveConfig(partial);
    await reload();
  }, [reload]);

  const testAI = useCallback(async () => {
    return await lumen().ai.test();
  }, []);

  return { settings, aiConfig, loading, reload, set, saveAIConfig, testAI };
}
