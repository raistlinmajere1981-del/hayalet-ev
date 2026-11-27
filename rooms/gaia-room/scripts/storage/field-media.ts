import { constants } from "node:fs";
import { copyFile, link, open, realpath, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, sep } from "node:path";
import { hasCode } from "./files.ts";
import { uuid } from "./batch.ts";
import { randomUUID } from "node:crypto";

// Pin the selected parent across use. B3 field ownership already requires Linux/POSIX.
async function inDirectory<T>(dir: string, root: string, work: (pinned: string) => Promise<T>) {
  if (
    !isAbsolute(dir) ||
    (await realpath(dir)) !== dir ||
    dir === root ||
    dir.startsWith(root + sep)
  )
    throw new Error("Unsafe Gaia media directory");
  const fd = await open(dir, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const pinned = "/proc/self/fd/" + fd.fd;
    if ((await realpath(pinned)) !== dir) throw new Error("Gaia media directory changed");
    return await work(pinned);
  } finally {
    await fd.close();
  }
}

export function readUsbJson(path: string, root: string): Promise<unknown> {
  return inDirectory(dirname(path), root, async (parent) => {
    if ((await realpath(path)) !== path || !path.endsWith(".json"))
      throw new Error("Unsafe Gaia USB file");
    const fd = await open(
      join(parent, basename(path)),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
    );
    try {
      const st = await fd.stat();
      if (!st.isFile() || st.nlink !== 1 || st.size < 1 || st.size > 65536)
        throw new Error("Invalid Gaia USB file");
      const bytes = Buffer.alloc(st.size + 1);
      if ((await fd.read(bytes, 0, bytes.length, 0)).bytesRead !== st.size)
        throw new Error("Gaia USB file changed");
      const parsed: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, st.size))
      );
      return parsed;
    } finally {
      await fd.close();
    }
  });
}

export async function exportInstallation(
  dir: string,
  root: string,
  operationId: string,
  pkg: unknown,
  check: () => void
) {
  uuid(operationId);
  const filename = "gaia-install-" + operationId + ".json";
  await inDirectory(dir, root, async (parent) => {
    const tmp = join(parent, ".pending-" + randomUUID());
    const fd = await open(tmp, "wx", 0o600);
    try {
      await fd.writeFile(JSON.stringify(pkg));
      await fd.sync();
      check();
      const target = join(parent, filename);
      try {
        await link(tmp, target);
      } catch (error) {
        // FAT removable media cannot hard-link. Exclusive copy also refuses any existing name.
        if (!["EPERM", "ENOTSUP", "ENOSYS"].some((code) => hasCode(error, code))) throw error;
        check();
        await copyFile(tmp, target, constants.COPYFILE_EXCL);
      }
    } finally {
      await fd.close();
      await unlink(tmp);
    }
  });
  return filename;
}
