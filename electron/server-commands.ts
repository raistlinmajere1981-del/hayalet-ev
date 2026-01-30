import { join } from 'path';
import { mkdir, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import { deviceActionHandler } from './device-manager.ts';
import { screenshotCaptureHandler } from './screenshot-manager.ts';
import { whisperLoad, whisperSave } from './whisper-manager.ts';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';

let _mainWindow: BrowserWindow | null = null;

function nowStamp() {
  return new Date().toLocaleString('tr-TR');
}

async function appendLogLine(line: string): Promise<void> {
  try {
    const baseDir = join(process.cwd(), 'logs');
    if (!existsSync(baseDir)) {
      await mkdir(baseDir, { recursive: true });
    }
    const path = join(baseDir, 'server-commands.log');
    await appendFile(path, line + '\n', 'utf-8');
  } catch (err: unknown) {
  }
}

const COMMAND_LIST = [
  'DeviceManager',
  'FileManager',
  'WebviewManager',
  'WhisperManager',
  'WindowManager',
  'ScreenshotManager',
  'TakeScreenshot',
  'PlayMusic',
  'Restart',
  'AIAIChatStart',
  'AIAIChatStop',
  'GetFile',
  'GetItDone',
  'ListFiles',
];

interface CommandPayload {
  args?: string;
  provider?: string;
  source?: string;
  sender?: string;
  [key: string]: unknown;
}

interface ServerCommandsOptions {
  mainWindow?: BrowserWindow | null;
}

const handlers: Record<string, (payload: CommandPayload) => Promise<unknown>> = {};

const defaultHandler = (name: string) => async (payload: CommandPayload = {}) => {
  const stamp = nowStamp();
  const info = payload?.args ? ` | args: ${payload.args}` : '';
  const line = `[${stamp}] server-command INFO ${name}${info}`;
  await appendLogLine(line);
  return { success: true, command: name, args: payload?.args || '', detail: 'OK' };
};

const parseArgs = (rawArgs = '') => {
  const args = typeof rawArgs === 'string' ? rawArgs : '';
  const parts = [];
  const regex = /"([^"]*)"|'([^']*)'|([^,\s]+)/g;
  let match;
  while ((match = regex.exec(args)) !== null) {
    const val = match[1] ?? match[2] ?? match[3] ?? '';
    if (val.trim()) parts.push(val.trim());
  }
  return parts;
};

const parseWhisperArgs = (rawArgs = '', fallbackProvider = 'ai1') => {
  const parts = parseArgs(rawArgs);
  const [user, text, when] = parts;
  return { user: user || fallbackProvider, text: text || '', when: when || '' };
};

const parseScreenshotArgs = (rawArgs = '') => {
  const parts = parseArgs(rawArgs);
  const kind = (parts[0] || 'system').toLowerCase();
  const selectorOrId = parts[1] || '';
  const format = parts[2] || '';
  return { kind, selectorOrId, format };
};

const parseWindowArgs = (rawArgs = '') => {
  const parts = parseArgs(rawArgs);
  const action = (parts[0] || 'minimize').toLowerCase();
  return { action };
};

COMMAND_LIST.forEach((name) => {
  if (name === 'WhisperManager') return;
  handlers[name.toLowerCase()] = defaultHandler(name);
});

handlers.whispermanager = async (payload: CommandPayload = {}) => {
  const stamp = nowStamp();
  const providerRaw = payload?.provider || 'AI';
  const provider = payload?.source === 'manual' ? (payload?.sender || 'user') : providerRaw;
  const { user, text, when } = parseWhisperArgs(payload?.args, provider);
  const argsLabel = payload?.args || `"${user}","${text}","${when}"`;
  try {
    const current = await whisperLoad(null as unknown as IpcMainInvokeEvent, { accountId: provider }).catch(() => ({ pending: [] as unknown[], done: [] as unknown[] }));
    const pending = Array.isArray(current?.pending) ? current.pending : [];
    const rec = { user, text, when, ts: Date.now() };
    pending.push(rec);
    const saveRes = await whisperSave(null as unknown as IpcMainInvokeEvent, { accountId: provider, payload: { pending, done: current?.done || [] } });
    await appendLogLine(`[${stamp}] WhisperManager added for ${provider}: ${argsLabel}`);
    return { success: !!saveRes?.success, command: 'WhisperManager', args: argsLabel, record: rec };
  } catch (err: unknown) {
    await appendLogLine(`[${stamp}] WhisperManager error: ${(err as Error)?.message || err}`);
    return { success: false, message: (err as Error)?.message || 'WhisperManager error' };
  }
};

handlers.devicemanager = async (payload: CommandPayload = {}) => {
  try {
    const parts = parseArgs(payload?.args || '');
    const action = (parts[0] || '').toLowerCase();
    const params = parts.slice(1);
    const res = await deviceActionHandler(null as unknown as IpcMainInvokeEvent, action, params);
    await appendLogLine(`[${nowStamp()}] DeviceManager ${action} -> ${JSON.stringify(res)}`);
    return { success: !!res?.success, result: res };
  } catch (err: unknown) {
    await appendLogLine(`[${nowStamp()}] DeviceManager error: ${(err as Error)?.message || err}`);
    return { success: false, message: (err as Error)?.message || 'DeviceManager error' };
  }
};

handlers.screenshotmanager = async (payload: CommandPayload = {}) => {
  try {
    const { kind: _kind, selectorOrId, format } = parseScreenshotArgs(payload?.args || '');
    const options: { format?: string; region?: string } = {};
    if (format) options.format = format;
    if (selectorOrId) options.region = selectorOrId;
    const res = await screenshotCaptureHandler(null, options);
    if (res?.success) {
      await appendLogLine(`[${nowStamp()}] ScreenshotManager saved ${res.path || 'in-memory'}`);
      return { success: true, path: res.path || null, dataUrl: res.dataUrl || null };
    }
    return { success: false, message: res?.message || 'screenshot failed' };
  } catch (err: unknown) {
    await appendLogLine(`[${nowStamp()}] ScreenshotManager error: ${(err as Error)?.message || err}`);
    return { success: false, message: (err as Error)?.message || 'ScreenshotManager error' };
  }
};

handlers.takescreenshot = handlers.screenshotmanager;

handlers.windowmanager = async (payload: CommandPayload = {}) => {
  try {
    const { action } = parseWindowArgs(payload?.args || '');
    if (!_mainWindow) return { success: false, message: 'no-window' };
    let result = false;
    if (action === 'minimize') {
      _mainWindow.minimize();
      result = true;
    } else if (action === 'fullscreen' || action === 'maximize') {
      _mainWindow.setFullScreen(true);
      result = true;
    } else if (action === 'restore') {
      _mainWindow.restore();
      result = true;
    }
    await appendLogLine(`[${nowStamp()}] WindowManager action=${action} -> ${result}`);
    return { success: !!result, action, executed: result };
  } catch (err: unknown) {
    await appendLogLine(`[${nowStamp()}] WindowManager error: ${(err as Error)?.message || err}`);
    return { success: false, message: (err as Error)?.message || 'WindowManager error' };
  }
};

handlers.restart = async (_payload: CommandPayload = {}) => {
  try {
    await appendLogLine(`[${nowStamp()}] Restart requested`);
    return { success: true, message: 'restart requested' };
  } catch (err: unknown) {
    await appendLogLine(`[${nowStamp()}] Restart error: ${(err as Error)?.message || err}`);
    return { success: false, message: (err as Error)?.message || 'Restart error' };
  }
};

handlers.listfiles = async (_payload: CommandPayload = {}) => {
  try {
    if (!_mainWindow) return { success: false, message: 'no-main-window' };
    const baseDir = process.cwd();
    return { success: true, command: 'ListFiles', path: baseDir, fileName: 'root', lines: 0 };
  } catch (err: unknown) {
    await appendLogLine(`[${nowStamp()}] ListFiles error: ${(err as Error)?.message || err}`);
    return { success: false, message: (err as Error)?.message || 'ListFiles error' };
  }
};

export const ServerCommands = {
  init(opts: ServerCommandsOptions = {}): void {
    _mainWindow = opts.mainWindow || null;
  },
  async run(_event: IpcMainInvokeEvent | null, commandName: string, payload: CommandPayload = {}): Promise<unknown> {
    const key = (commandName || '').toLowerCase();
    const handler = handlers[key];
    if (handler) return handler(payload);
    await appendLogLine(`[${nowStamp()}] Undefined command: ${commandName}`);
    return { success: false, message: 'Undefined command' };
  },
  list() {
    return [...COMMAND_LIST];
  },
};
