import { dirname } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { nativeImage, BrowserWindow } from 'electron';
import screenshot from 'screenshot-desktop';

export async function capturePageHandler(event, type = 'full', region = '') {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error('Pencere bulunamadı');
    const bounds = win.getBounds();
    let rect = { x: 0, y: 0, width: bounds.width, height: bounds.height };
    if (region) {
      const match = region.match(/(\d+)[;,](\d+)[: ](\d+)[;,](\d+)/);
      if (match) {
        const [, x, y, w, h] = match.map(Number);
        rect = { x, y, width: w, height: h };
      }
    }
    const img = await win.capturePage(rect);
    const dataUrl = img.toDataURL();
    return { success: true, dataUrl };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

export async function screenshotCaptureHandler(event, options = {}) {
  const { region = '', hideCursor = false, filePath = '', format = 'png' } = options || {};
  try {
    const useJpg = (format || '').toLowerCase() === 'jpg' || (format || '').toLowerCase() === 'jpeg';
    const buffer = await screenshot({ format: useJpg ? 'jpg' : 'png', cursor: !hideCursor });
    let img = nativeImage.createFromBuffer(buffer);
    if (region) {
      const match = region.match(/(\d+)[;,](\d+)[: ](\d+)[;,](\d+)/);
      if (match) {
        const [, x, y, w, h] = match.map(Number);
        img = img.crop({ x, y, width: w, height: h });
      }
    }
    const dataBuffer = useJpg ? img.toJPEG(90) : img.toPNG();
    const dataUrl = `data:image/${useJpg ? 'jpeg' : 'png'};base64,${dataBuffer.toString('base64')}`;
    let savedPath = filePath;
    if (filePath) {
      const targetDir = dirname(filePath);
      if (!existsSync(targetDir)) {
        await mkdir(targetDir, { recursive: true });
      }
      await writeFile(filePath, dataBuffer);
    }
    return { success: true, dataUrl, path: savedPath || null };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
