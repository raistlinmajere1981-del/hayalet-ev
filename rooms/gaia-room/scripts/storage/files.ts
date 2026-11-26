import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rename, rm, unlink } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { dirname, join } from "node:path";

export function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

export async function directory(parent: string, name: string, create: boolean): Promise<string> {
  const dir = join(parent, name);
  if (create)
    await mkdir(dir, { mode: 0o700 }).catch((error) => {
      if (!hasCode(error, "EEXIST")) throw error;
    });
  if (!(await lstat(dir)).isDirectory()) throw new Error("Unsafe project directory");
  return dir;
}

async function regular(path: string): Promise<boolean> {
  const stat = await lstat(path).catch((error) => {
    if (hasCode(error, "ENOENT")) return null;
    throw error;
  });
  if (stat && (!stat.isFile() || stat.nlink !== 1)) throw new Error("Unsafe project file");
  return Boolean(stat);
}

export async function readRegular(path: string, maxBytes?: number): Promise<Buffer> {
  await regular(path);
  const fd = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    if (maxBytes !== undefined) {
      const { size } = await fd.stat();
      if (size > maxBytes)
        throw Object.assign(new Error("Gaia file exceeds size limit"), {
          code: "ERR_GAIA_FILE_SIZE",
        });
      const buffer = Buffer.allocUnsafe(size + 1);
      const { bytesRead } = await fd.read(buffer, 0, buffer.length, 0);
      if (bytesRead !== size) throw new Error("Gaia file changed during read");
      return buffer.subarray(0, bytesRead);
    }
    return await fd.readFile();
  } finally {
    await fd.close();
  }
}

export async function removeRegular(path: string): Promise<void> {
  if (await regular(path)) await unlink(path);
}

export async function publish(path: string, bytes: string | Buffer): Promise<void> {
  await regular(path);
  const tmp = join(dirname(path), `.pending-${randomUUID()}`);
  const fd = await open(tmp, "wx", 0o600);
  try {
    try {
      await fd.writeFile(bytes);
      await fd.sync();
    } finally {
      await fd.close();
    }
    await rename(tmp, path);
  } finally {
    await rm(tmp, { force: true });
  }
}

const queues = new Map<string, Promise<unknown>>();
export async function acquireDirectoryLock(dir: string, owner = false) {
  // Keep the existing writer namespace so an older process still contends on the same project.
  const key =
    (owner ? "hev-gaia-owner-" : "hev-gaia-") +
    createHash("sha256")
      .update(await realpath(dir))
      .digest("hex")
      .slice(0, 40);
  const address = process.platform === "win32" ? "\\\\.\\pipe\\" + key : "\0" + key;
  const lock = createServer((socket) => socket.destroy());
  await new Promise<void>((resolve, reject) => {
    lock.once("error", reject);
    lock.listen(address, resolve);
  });
  lock.unref();
  return () =>
    new Promise<void>((resolve, reject) =>
      lock.close((error) => (error ? reject(error) : resolve()))
    );
}

export async function serialized<T>(dir: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(dir) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      const release = await acquireDirectoryLock(dir);
      try {
        return await work();
      } finally {
        await release();
      }
    });
  queues.set(dir, next);
  try {
    return await next;
  } finally {
    if (queues.get(dir) === next) queues.delete(dir);
  }
}
