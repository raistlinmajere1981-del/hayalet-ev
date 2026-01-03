import { spawnSync } from 'child_process';

function run(cmd, cmdArgs) {
  try {
    const res = spawnSync(cmd, cmdArgs, { encoding: 'utf8' });
    const ok = res.status === 0 || res.status === null;
    return { success: ok, stdout: res.stdout || '', stderr: res.stderr || '', code: res.status };
  } catch (err) {
    return { success: false, message: err?.message || String(err) };
  }
}

export async function deviceActionHandler(event, action, payload) {
  try {
    const act = String(action || '').toLowerCase();
    const args = Array.isArray(payload) ? payload : typeof payload === 'string' ? [payload] : [];

    if (process.platform !== 'linux') {
      return { success: false, message: 'Device actions supported on Linux only' };
    }

    if (act === 'movemouse' || act === 'move_mouse' || act === 'mouse_move') {
      const x = Number(args[0] || 0);
      const y = Number(args[1] || 0);
      return run('xdotool', ['mousemove', String(x), String(y)]);
    }

    if (act === 'click' || act === 'leftclick') {
      const button = args[0] ? String(args[0]) : '1';
      return run('xdotool', ['click', String(button)]);
    }

    if (act === 'clickdown' || act === 'mousedown') {
      const button = args[0] ? String(args[0]) : '1';
      return run('xdotool', ['mousedown', String(button)]);
    }

    if (act === 'clickup' || act === 'mouseup') {
      const button = args[0] ? String(args[0]) : '1';
      return run('xdotool', ['mouseup', String(button)]);
    }

    if (act === 'rclick' || act === 'rightclick') {
      return run('xdotool', ['click', '3']);
    }

    if (act === 'key') {
      const key = String(args[0] || '');
      if (!key) return { success: false, message: 'key missing' };
      return run('xdotool', ['key', key]);
    }

    if (act === 'type' || act === 'write') {
      const text = String(args[0] || '');
      if (!text) return { success: false, message: 'text missing' };
      return run('xdotool', ['type', '--delay', '0', text]);
    }

    if (act === 'copy') {
      const text = String(args[0] || '');
      if (!text) return { success: false, message: 'text missing' };
      const which = spawnSync('which', ['xclip'], { encoding: 'utf8' });
      if (which.status !== 0) return { success: false, message: 'xclip not installed' };
      const proc = spawnSync('bash', ['-c', `printf %s "${text.replace(/"/g, '\\"')}" | xclip -selection clipboard`], { encoding: 'utf8' });
      return { success: proc.status === 0, stdout: proc.stdout || '', stderr: proc.stderr || '' };
    }

    if (act === 'paste') {
      return run('xdotool', ['key', 'ctrl+v']);
    }

    return { success: false, message: 'unknown action' };
  } catch (err) {
    console.error('device-action error', err);
    return { success: false, message: err?.message || String(err) };
  }
}
