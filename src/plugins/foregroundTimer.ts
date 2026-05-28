import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface ForegroundTimerPlugin {
  start(opts: { elapsedMs: number; state: 'active' | 'paused' }): Promise<void>;
  update(opts: { elapsedMs: number; state: 'active' | 'paused' }): Promise<void>;
  stop(): Promise<void>;
  addListener(
    event: 'actionPerformed',
    handler: (data: { action: 'pause' | 'resume' | 'stop' }) => void,
  ): Promise<PluginListenerHandle>;
}

export const ForegroundTimer = registerPlugin<ForegroundTimerPlugin>('ForegroundTimer');
