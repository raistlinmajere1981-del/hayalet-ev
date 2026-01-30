import { join, basename } from 'path';
import { readdir, readFile, writeFile, mkdir, rename, copyFile, unlink, rm } from 'fs/promises';
import { existsSync } from 'fs';
import type { IpcMainInvokeEvent } from 'electron';

interface CommandDirs {
  root: string;
  doneDir: string;
  failedDir: string;
}

interface CommandItem {
  id: string;
  [key: string]: unknown;
}

interface StagedFile {
  originalName: string;
  renamedName: string;
  name: string;
  commandPath: string;
  tempPath?: string;
  path?: string;
}

const COMMAND_ROOT = (): string => join(process.cwd(), 'commands');

async function ensureCommandDirs(): Promise<CommandDirs> {
  const root = COMMAND_ROOT();
  const doneDir = join(root, 'done');
  const failedDir = join(root, 'failed');
  if (!existsSync(root)) await mkdir(root, { recursive: true });
  if (!existsSync(doneDir)) await mkdir(doneDir, { recursive: true });
  if (!existsSync(failedDir)) await mkdir(failedDir, { recursive: true });
  return { root, doneDir, failedDir };
}

/**
 * Main Process: Command Queue Persistence Layer
 * Bu modül SADECE dosya I/O işlemlerini yapar.
 * Queue management renderer tarafında (src/js/modules/command-manager.js)
 */

export async function commandInit(
  _event: IpcMainInvokeEvent
): Promise<{ success: boolean; root?: string; failedDir?: string; error?: string }> {
  try {
    const { root, failedDir } = await ensureCommandDirs();
    const entries = await readdir(root, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile()) {
        await rename(join(root, e.name), join(failedDir, e.name));
      }
    }
    return { success: true, root, failedDir };
  } catch (err) {
    return { success: false, error: (err as Error)?.message };
  }
}

export async function commandWrite(
  _event: IpcMainInvokeEvent,
  item: CommandItem
): Promise<boolean> {
  try {
    const { root } = await ensureCommandDirs();
    const filePath = join(root, `${item.id}.json`);
    await writeFile(filePath, JSON.stringify(item, null, 2), 'utf-8');
    return true;
  } catch (_err) {
    return false;
  }
}

export async function commandPaths(_event: IpcMainInvokeEvent): Promise<CommandDirs> {
  return ensureCommandDirs();
}

export async function commandStageAttachments(
  _event: IpcMainInvokeEvent,
  payload: { jobId?: string; files?: (string | { path?: string })[] } = {}
): Promise<{ success: boolean; message?: string; staged?: StagedFile[] }> {
  const { jobId, files = [] } = payload;
  if (!jobId) return { success: false, message: 'jobId eksik' };
  const inputs = Array.isArray(files) ? files.filter(Boolean) : [];
  try {
    const { root } = await ensureCommandDirs();
    const targetDir = join(root, jobId);
    if (!existsSync(targetDir)) await mkdir(targetDir, { recursive: true });
    const staged: StagedFile[] = [];
    for (const input of inputs) {
      const src = typeof input === 'string' ? input : (input as { path?: string }).path || '';
      if (!src || !existsSync(src)) continue;
      const base = basename(src);
      const insideTarget = src.startsWith(targetDir);
      if (insideTarget) {
        staged.push({
          originalName: base,
          renamedName: base,
          name: base,
          commandPath: src,
        });
        continue;
      }
      let renamed = base;
      let counter = 1;
      while (existsSync(join(targetDir, renamed))) {
        const parts = base.split('.');
        const ext = parts.length > 1 ? `.${parts.pop()}` : '';
        const stem = parts.join('.') || 'file';
        renamed = `${stem} (${counter})${ext}`;
        counter += 1;
      }
      await copyFile(src, join(targetDir, renamed));
      staged.push({
        originalName: base,
        renamedName: renamed,
        name: renamed,
        commandPath: join(targetDir, renamed),
      });
    }
    return { success: true, staged };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function commandStageTemp(
  _event: IpcMainInvokeEvent,
  payload: { staged?: StagedFile[] } = {}
): Promise<{ success: boolean; message?: string; temp?: StagedFile[] }> {
  const { staged = [] } = payload;
  try {
    const tempList = (staged || []).map((entry) => ({
      ...entry,
      tempPath: entry.commandPath || entry.tempPath || entry.path,
      name: entry.renamedName || entry.originalName || basename(entry.commandPath || entry.path || 'file'),
    }));
    return { success: true, temp: tempList };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function commandCleanupTemp(
  _event: IpcMainInvokeEvent,
  payload: { tempPaths?: string[] } = {}
): Promise<{ success: boolean; message?: string }> {
  const { tempPaths = [] } = payload;
  try {
    for (const p of tempPaths) {
      if (p && existsSync(p)) {
        await unlink(p).catch(() => { /* noop */ });
      }
    }
    return { success: true };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function commandMoveFailed(
  _event: IpcMainInvokeEvent,
  payload: { jobId?: string; tempPaths?: string[] } = {}
): Promise<{ success: boolean; message?: string; destDir?: string }> {
  const { jobId, tempPaths = [] } = payload;
  if (!jobId) return { success: false, message: 'jobId eksik' };
  try {
    const { root, failedDir } = await ensureCommandDirs();
    const srcDir = join(root, jobId);
    const destDir = join(failedDir, jobId);
    if (existsSync(srcDir)) {
      if (!existsSync(destDir)) await mkdir(destDir, { recursive: true });
      const entries = await readdir(srcDir, { withFileTypes: true });
      for (const e of entries) {
        await rename(join(srcDir, e.name), join(destDir, e.name)).catch(() => { /* noop */ });
      }
    }
    for (const p of tempPaths) {
      if (p && existsSync(p)) {
        if (!existsSync(destDir)) await mkdir(destDir, { recursive: true });
        const base = basename(p);
        await rename(p, join(destDir, base)).catch(async () => {
          await copyFile(p, join(destDir, base)).catch(() => { /* noop */ });
          await unlink(p).catch(() => { /* noop */ });
        });
      }
    }
    return { success: true, destDir };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function commandArchiveCopy(
  _event: IpcMainInvokeEvent,
  payload: { jobId?: string; targetDir?: string } = {}
): Promise<{ success: boolean; message?: string; targetDir?: string }> {
  const { jobId, targetDir } = payload;
  if (!jobId || !targetDir) return { success: false, message: 'Parametre eksik' };
  try {
    const { root } = await ensureCommandDirs();
    const srcDir = join(root, jobId);
    if (!existsSync(srcDir)) return { success: false, message: 'Kaynak klasör yok' };
    if (!existsSync(targetDir)) await mkdir(targetDir, { recursive: true });
    const entries = await readdir(srcDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const src = join(srcDir, e.name);
      const dest = join(targetDir, e.name);
      await copyFile(src, dest);
    }
    return { success: true, targetDir };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function commandCleanupJob(
  _event: IpcMainInvokeEvent,
  payload: { jobId?: string; tempPaths?: string[] } = {}
): Promise<{ success: boolean; message?: string }> {
  const { jobId, tempPaths: _tempPaths = [] } = payload;
  if (!jobId) return { success: false, message: 'jobId eksik' };
  try {
    const { root } = await ensureCommandDirs();
    const jobDir = join(root, jobId);
    if (existsSync(jobDir)) {
      await rm(jobDir, { recursive: true, force: true }).catch(() => { /* noop */ });
    }
    return { success: true };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function commandMove(
  _event: IpcMainInvokeEvent,
  id: string,
  status: string = 'done',
  reason: string = ''
): Promise<boolean> {
  try {
    const { root, doneDir, failedDir } = await ensureCommandDirs();
    const src = join(root, `${id}.json`);
    const destDir = status === 'failed' ? failedDir : doneDir;
    const dest = join(destDir, `${id}.json`);
    if (existsSync(src)) {
      if (reason) {
        const data = JSON.parse(await readFile(src, 'utf-8'));
        data.status = status;
        data.reason = reason;
        await writeFile(src, JSON.stringify(data, null, 2), 'utf-8');
      }
      await rename(src, dest);
    }
    return true;
  } catch (_err) {
    return false;
  }
}
