import { dirname } from "path";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import type { IpcMainInvokeEvent } from "electron";
import { nativeImage, BrowserWindow } from "electron";
import screenshot from "screenshot-desktop";

interface CaptureResult {
  success: boolean;
  dataUrl?: string;
  path?: string | null;
  message?: string;
}

export async function capturePageHandler(
  event: IpcMainInvokeEvent,
  _type: string = "full",
  region: string = ""
): Promise<CaptureResult> {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) ?? BrowserWindow.getAllWindows()[0];
    if (win === undefined) throw new Error("Pencere bulunamadı");
    const bounds = win.getBounds();
    let rect = { x: 0, y: 0, width: bounds.width, height: bounds.height };
    if (region.length > 0) {
      const match = region.match(/(\d+)[;,](\d+)[: ](\d+)[;,](\d+)/);
      if (match !== null) {
        const nums = match.slice(1).map(Number);
        rect = { x: nums[0] ?? 0, y: nums[1] ?? 0, width: nums[2] ?? 0, height: nums[3] ?? 0 };
      }
    }
    const img = await win.capturePage(rect);
    const dataUrl = img.toDataURL();
    return { success: true, dataUrl };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

interface ScreenshotOptions {
  region?: string;
  hideCursor?: boolean;
  filePath?: string;
  format?: string;
}

export async function screenshotCaptureHandler(
  _event: IpcMainInvokeEvent | null,
  options: ScreenshotOptions = {}
): Promise<CaptureResult> {
  const { region = "", hideCursor: _hideCursor = false, filePath = "", format = "png" } = options;
  try {
    const formatLower = format.toLowerCase();
    const useJpg = formatLower === "jpg" || formatLower === "jpeg";
    const buffer = await screenshot({ format: useJpg ? "jpg" : "png" } as Parameters<
      typeof screenshot
    >[0]);
    let img = nativeImage.createFromBuffer(Buffer.from(buffer));
    if (region.length > 0) {
      const match = region.match(/(\d+)[;,](\d+)[: ](\d+)[;,](\d+)/);
      if (match !== null) {
        const nums = match.slice(1).map(Number);
        img = img.crop({
          x: nums[0] ?? 0,
          y: nums[1] ?? 0,
          width: nums[2] ?? 0,
          height: nums[3] ?? 0,
        });
      }
    }
    const dataBuffer = useJpg ? img.toJPEG(90) : img.toPNG();
    const dataUrl = `data:image/${useJpg ? "jpeg" : "png"};base64,${dataBuffer.toString("base64")}`;
    const savedPath = filePath;
    if (filePath.length > 0) {
      const targetDir = dirname(filePath);
      if (!existsSync(targetDir)) {
        await mkdir(targetDir, { recursive: true });
      }
      await writeFile(filePath, dataBuffer);
    }
    return { success: true, dataUrl, path: savedPath };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}
