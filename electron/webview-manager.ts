import type { IpcMainInvokeEvent } from "electron";

interface UploadPayload {
  name?: string;
  mimeType?: string;
  base64?: string;
}

interface UploadResult {
  success: boolean;
  status?: number;
  statusText?: string;
  data?: string;
  message?: string;
}

export async function catboxUpload(
  _event: IpcMainInvokeEvent,
  payload: UploadPayload = {}
): Promise<UploadResult> {
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
    return { success: false, message: (err as Error)?.message || "catbox upload failed" };
  }
}

export async function uguuUpload(
  _event: IpcMainInvokeEvent,
  payload: UploadPayload = {}
): Promise<UploadResult> {
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
    return { success: false, message: (err as Error)?.message || "uguu upload failed" };
  }
}

