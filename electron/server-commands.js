import { join } from 'path';
import { mkdir, appendFile } from 'fs/promises';
import { existsSync } from 'fs';
import { deviceActionHandler } from './device-manager.js';
import { screenshotCaptureHandler } from './screenshot-manager.js';
import { whisperLoad, whisperSave } from './whisper-manager.js';

let _mainWindow = null;

function nowStamp() {
  return new Date().toLocaleString('tr-TR');
}

async function appendLogLine(line) {
  try {
    const baseDir = join(process.cwd(), 'logs');
    if (!existsSync(baseDir)) {
      await mkdir(baseDir, { recursive: true });
    }
    const path = join(baseDir, 'server-commands.log');
    await appendFile(path, line + '\n', 'utf-8');
  } catch (err) {
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

const handlers = {};

const defaultHandler = (name) => async (payload = {}) => {
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

handlers.whispermanager = async (payload = {}) => {
  const stamp = nowStamp();
  const providerRaw = payload?.provider || 'AI';
  const provider = payload?.source === 'manual' ? (payload?.sender || 'user') : providerRaw;
  const { user, text, when } = parseWhisperArgs(payload?.args, provider);
  const argsLabel = payload?.args || `"${user}","${text}","${when}"`;
  try {
    const current = await whisperLoad(null, provider).catch(() => ({ pending: [], done: [] }));
    const pending = Array.isArray(current?.pending) ? current.pending : [];
    const rec = { user, text, when, ts: Date.now() };
    pending.push(rec);
    const saveRes = await whisperSave(null, provider, { pending, done: current?.done || [] });
    await appendLogLine(`[${stamp}] WhisperManager added for ${provider}: ${argsLabel}`);
    return { success: !!saveRes?.success, command: 'WhisperManager', args: argsLabel, record: rec };
  } catch (err) {
    await appendLogLine(`[${stamp}] WhisperManager error: ${err?.message || err}`);
    return { success: false, message: err?.message || 'WhisperManager error' };
  }
};

handlers.devicemanager = async (payload = {}) => {
  try {
    const parts = parseArgs(payload?.args || '');
    const action = (parts[0] || '').toLowerCase();
    const params = parts.slice(1);
    const res = await deviceActionHandler(null, action, params);
    await appendLogLine(`[${nowStamp()}] DeviceManager ${action} -> ${JSON.stringify(res)}`);
    return { success: !!res?.success, result: res };
  } catch (err) {
    await appendLogLine(`[${nowStamp()}] DeviceManager error: ${err?.message || err}`);
    return { success: false, message: err?.message || 'DeviceManager error' };
  }
};

handlers.screenshotmanager = async (payload = {}) => {
  try {
    const { kind, selectorOrId, format } = parseScreenshotArgs(payload?.args || '');
    const options = {};
    if (format) options.format = format;
    if (selectorOrId) options.region = selectorOrId;
    const fakeEvent = { sender: _mainWindow?.webContents };
    const res = await screenshotCaptureHandler(fakeEvent, options);
    if (res?.success) {
      await appendLogLine(`[${nowStamp()}] ScreenshotManager saved ${res.path || 'in-memory'}`);
      return { success: true, path: res.path || null, dataUrl: res.dataUrl || null };
    }
    return { success: false, message: res?.message || 'screenshot failed' };
  } catch (err) {
    await appendLogLine(`[${nowStamp()}] ScreenshotManager error: ${err?.message || err}`);
    return { success: false, message: err?.message || 'ScreenshotManager error' };
  }
};

handlers.takescreenshot = handlers.screenshotmanager;

handlers.windowmanager = async (payload = {}) => {
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
  } catch (err) {
    await appendLogLine(`[${nowStamp()}] WindowManager error: ${err?.message || err}`);
    return { success: false, message: err?.message || 'WindowManager error' };
  }
};

handlers.restart = async (payload = {}) => {
  try {
    await appendLogLine(`[${nowStamp()}] Restart requested`);
    return { success: true, message: 'restart requested' };
  } catch (err) {
    await appendLogLine(`[${nowStamp()}] Restart error: ${err?.message || err}`);
    return { success: false, message: err?.message || 'Restart error' };
  }
};

handlers.listfiles = async (payload = {}) => {
  try {
    if (!_mainWindow) return { success: false, message: 'no-main-window' };
    const baseDir = process.cwd();
    return { success: true, command: 'ListFiles', path: baseDir, fileName: 'root', lines: 0 };
  } catch (err) {
    await appendLogLine(`[${nowStamp()}] ListFiles error: ${err?.message || err}`);
    return { success: false, message: err?.message || 'ListFiles error' };
  }
};

export const ServerCommands = {
  init(opts = {}) {
    _mainWindow = opts.mainWindow || null;
  },
  async run(event, commandName, payload = {}) {
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
