import { PassThrough } from 'stream';
import { google } from 'googleapis';
import { loadSettings, saveSettings } from './settings-manager.js';

function safeGet(obj, path, def = '') {
  try {
    return path.split('.').reduce((s, k) => (s && s[k] !== undefined ? s[k] : undefined), obj) ?? def;
  } catch {
    return def;
  }
}

export async function googledriveStartAuth(event) {
  try {
    let settings = {};
    try {
      settings = (await loadSettings()) || {};
    } catch (err) {
      settings = {};
    }
    const gconf = safeGet(settings, 'human.googledrive', {});
    const clientId = gconf.clientId || process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = gconf.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) {
      return { success: false, message: 'Google Client ID/Secret ayarlı değil' };
    }
    const redirect = 'urn:ietf:wg:oauth:2.0:oob';
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirect);
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email'],
      prompt: 'consent',
    });
    try { globalThis?.process && (await Promise.resolve()); } catch (e) { /* noop */ }
    try {
    } catch (e) { /* noop */ }
    return { success: true, url };
  } catch (err) {
    console.error('googledrive-start-auth error:', err);
    return { success: false, message: err?.message || 'start-auth failed' };
  }
}

export async function googledriveExchangeCode(event, code) {
  try {
    if (!code) return { success: false, message: 'Yetkilendirme kodu eksik' };
    let settings = {};
    try {
      settings = (await loadSettings()) || {};
    } catch (err) {
      settings = {};
    }
    const gconf = safeGet(settings, 'human.googledrive', {});
    const clientId = gconf.clientId || process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = gconf.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) {
      return { success: false, message: 'Google Client ID/Secret ayarlı değil' };
    }
    const redirect = 'urn:ietf:wg:oauth:2.0:oob';
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirect);
    const { tokens } = await oauth2Client.getToken(String(code).trim());
    oauth2Client.setCredentials(tokens);
    settings.human = settings.human || {};
    settings.human.googledrive = settings.human.googledrive || {};
    settings.human.googledrive.tokens = tokens;
    
    let accountEmail = '';
    try {
      const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
      const me = (await oauth2.userinfo.get()).data;
      accountEmail = me?.email || '';
    } catch (err) { /* noop */ }
    
    // Set connected flag and account
    settings.human.googledrive.connected = true;
    settings.human.googledrive.account = accountEmail;
    
    try {
      await saveSettings(settings);
    } catch (err) {
      console.error('saveSettings failed:', err);
    }
    
    return { success: true, account: accountEmail };
  } catch (err) {
    console.error('googledrive-exchange-code error:', err);
    return { success: false, message: err?.message || 'exchange failed' };
  }
}

export async function googledriveDisconnect(event) {
  try {
    let settings = {};
    try {
      settings = (await loadSettings()) || {};
    } catch (err) {
      settings = {};
    }
    if (settings.human && settings.human.googledrive) {
      delete settings.human.googledrive.tokens;
      delete settings.human.googledrive.connected;
      delete settings.human.googledrive.account;
      try { await saveSettings(settings); } catch (err) { console.error('saveSettings failed during disconnect:', err); }
    }
    return { success: true };
  } catch (err) {
    console.error('googledrive-disconnect error:', err);
    return { success: false, message: err?.message || 'disconnect failed' };
  }
}

export async function googledriveUpload(event, payload = {}) {
  try {
    const files = Array.isArray(payload?.files) ? payload.files : [];
    if (!files.length) return { success: false, message: 'Dosya yok' };
    let settings = {};
    try { settings = (await loadSettings()) || {}; } catch (e) { settings = {}; }
    const gconf = safeGet(settings, 'human.googledrive', {});
    const clientId = gconf.clientId || process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = gconf.clientSecret || process.env.GOOGLE_CLIENT_SECRET || '';
    const tokens = gconf.tokens || null;
    if (!clientId || !clientSecret || !tokens) {
      return { success: false, message: 'Google Drive yetkilendirmesi eksik' };
    }
    const redirect = 'urn:ietf:wg:oauth:2.0:oob';
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirect);
    oauth2Client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const uploadedLinks = [];
    const errors = [];
    for (const file of files) {
      try {
        const buffer = Buffer.from(file.base64 || '', 'base64');
        const pass = new PassThrough();
        pass.end(buffer);
        const name = file.name || `file-${Date.now()}`;
        const isText = (file.mimeType || '').startsWith('text') || name.endsWith('.txt') || name.endsWith('.md');
        const resource = { name };
        if (isText) resource.mimeType = 'application/vnd.google-apps.document';
        const media = { mimeType: file.mimeType || 'application/octet-stream', body: pass };
        const res = await drive.files.create({ requestBody: resource, media, fields: 'id,name,webViewLink,webContentLink' });
        const fileId = res.data?.id; if (!fileId) throw new Error('Upload id missing');
        try { await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } }); } catch (err) { console.error('permission set error', err && err.message); }
        let url = '';
        if (isText) url = `https://docs.google.com/document/d/${fileId}/export?format=pdf`; else url = `https://drive.google.com/uc?export=view&id=${fileId}`;
        uploadedLinks.push({ name, url, id: fileId });
      } catch (err) {
        console.error('googledrive upload error for file', file?.name, err);
        errors.push({ name: file?.name || 'file', message: err?.message || err });
      }
    }
    if (!uploadedLinks.length) return { success: false, message: 'Yükleme başarısız', errors };
    return { success: true, uploadedLinks, errors: errors.length ? errors : undefined };
  } catch (err) {
    console.error('googledrive-upload error:', err);
    return { success: false, message: err?.message || 'upload failed' };
  }
}
