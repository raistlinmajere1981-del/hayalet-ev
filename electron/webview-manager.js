import { join } from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
// googledriveUpload moved to electron/googledrive-manager.js

// Catbox upload proxy: receive base64 file and upload from main process to avoid webview/CORS issues
export async function catboxUpload(_event, payload = {}) {
  try {
    const {
      name,
      mimeType = "application/octet-stream",
      base64,
    } = payload || {};
    if (!base64 || !name) return { success: false, message: "Eksik parametre" };

    const url = "https://catbox.moe/user/api.php";
    const boundary = `----HayaletEv${Date.now()}`;
    const eol = "\r\n";
    const fileBuffer = Buffer.from(base64, "base64");

    let pre = `--${boundary}${eol}`;
    pre += `Content-Disposition: form-data; name="fileToUpload"; filename="${name}"${eol}`;
    pre += `Content-Type: ${mimeType}${eol}${eol}`;
    const post = `${eol}--${boundary}${eol}Content-Disposition: form-data; name="reqtype"${eol}${eol}fileupload${eol}--${boundary}--${eol}`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(pre, "utf8"),
      fileBuffer,
      Buffer.from(post, "utf8"),
    ]);

    let res;
    if (typeof fetch === "function") {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: bodyBuffer,
      });
    } else {
      throw new Error(
        "Global fetch is not available in this Node runtime. Please run on Node 18+ or provide a fetch polyfill.",
      );
    }

    const text = await res.text();
    return {
      success: res.ok,
      status: res.status,
      statusText: res.statusText,
      data: text,
    };
  } catch (err) {
    return { success: false, message: err?.message || "catbox upload failed" };
  }
}

// Uguu upload proxy
export async function uguuUpload(_event, payload = {}) {
  try {
    const {
      name,
      mimeType = "application/octet-stream",
      base64,
    } = payload || {};
    if (!base64 || !name) return { success: false, message: "Eksik parametre" };

    const url = "https://uguu.se/upload.php";
    const boundary = `----HayaletEvUguu${Date.now()}`;
    const eol = "\r\n";
    const fileBuffer = Buffer.from(base64, "base64");

    let pre = `--${boundary}${eol}`;
    pre += `Content-Disposition: form-data; name="files[]"; filename="${name}"${eol}`;
    pre += `Content-Type: ${mimeType}${eol}${eol}`;
    const post = `${eol}--${boundary}--${eol}`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(pre, "utf8"),
      fileBuffer,
      Buffer.from(post, "utf8"),
    ]);

    let res;
    if (typeof fetch === "function") {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: bodyBuffer,
      });
    } else {
      throw new Error(
        "Global fetch is not available in this Node runtime. Please run on Node 18+ or provide a fetch polyfill.",
      );
    }

    const text = await res.text();
    return {
      success: res.ok,
      status: res.status,
      statusText: res.statusText,
      data: text,
    };
  } catch (err) {
    return { success: false, message: err?.message || "uguu upload failed" };
  }
}

// Archive sync: persist conversation messages and update index.json
export async function archiveSync(_event, payload = {}) {
  try {
    const provider = payload?.provider;
    const {
      webUrl,
      messages = [],
      authors = {},
      accountInfo = null,
    } = payload || {};
    if (!provider || !webUrl) {
      throw new Error("provider veya webUrl eksik");
    }

    const baseDir = join(process.cwd(), "archives");
    if (!existsSync(baseDir)) await mkdir(baseDir, { recursive: true });

    let archiveDir;
    if (accountInfo && accountInfo.email && accountInfo.provider) {
      const safeEmail = String(accountInfo.email)
        .replace(/[^a-z0-9@.-]/gi, "")
        .replace(/@/g, "_at_");
      const safeProvider = String(accountInfo.provider).replace(
        /[^a-z0-9_-]/gi,
        "",
      );
      archiveDir = join(baseDir, safeEmail, safeProvider);
    } else {
      archiveDir = join(baseDir, provider);
    }

    if (!existsSync(archiveDir)) {
      await mkdir(archiveDir, { recursive: true });
    }

    const indexPath = join(baseDir, "index.json");
    let indexData = [];
    if (existsSync(indexPath)) {
      try {
        indexData = JSON.parse(await readFile(indexPath, "utf-8")) || [];
      } catch {
        indexData = [];
      }
    }

    const now = Date.now();
    const existing = indexData.find(
      (item) =>
        item.provider === provider &&
        item.webUrl === webUrl &&
        (!accountInfo || item.accountId === accountInfo.id),
    );

    let convId;
    let folder;
    if (existing) {
      convId = existing.id;
      folder = existing.folder;
    } else {
      const lastNumber = Math.max(
        0,
        ...indexData
          .filter(
            (item) =>
              item.provider === provider &&
              (!accountInfo || item.accountId === accountInfo.id),
          )
          .map((item) => {
            const match = /conv-(\d+)/.exec(item.folder || "");
            return match ? parseInt(match[1], 10) : 0;
          }),
      );
      const nextNum = (lastNumber + 1).toString().padStart(4, "0");
      folder = join(archiveDir, `conv-${nextNum}`);
      convId = `${provider}-conv-${nextNum}`;
    }

    if (!existsSync(folder)) {
      await mkdir(folder, { recursive: true });
    }

    const meta = {
      id: convId,
      provider,
      folder,
      accountId: accountInfo?.id || null,
      email: accountInfo?.email || null,
      title: convId,
      summary: "",
      webUrl,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      messageCount: messages.length,
    };

    const history = messages.map((msg, idx) => ({
      index: idx,
      role: msg.role === "assistant" ? "assistant" : "user",
      author:
        msg.author ||
        (msg.role === "assistant" ? authors.ai : authors.user) ||
        "anon",
      text: msg.text || "",
      ts: msg.ts || now,
    }));

    await writeFile(
      join(folder, "history.json"),
      JSON.stringify(history, null, 2),
      "utf-8",
    );

    // Update index.json
    if (existing) {
      try {
        existing.webUrl = webUrl;
        await writeFile(indexPath, JSON.stringify(indexData, null, 2), "utf-8");
      } catch (err) {
      }
    } else {
      const newEntry = { ...meta };
      const filtered = indexData.filter((item) => item.id !== convId);
      filtered.push(newEntry);
      await writeFile(indexPath, JSON.stringify(filtered, null, 2), "utf-8");
    }

    return { success: true, meta, count: history.length };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
