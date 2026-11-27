import { dialog } from "electron";
import { execFile } from "node:child_process";

const choices = {
  csr: "Select Gaia USB CSR",
  package: "Select signed Gaia installation",
  media: "Select offline Gaia signing media",
  destination: "Select USB installation output directory",
};

const prompts = {
  provision: "Create the first Gaia field center and its server certificate?",
  rotateServer: "Replace the Gaia field server certificate?",
  start: "Start the field receiver on this interface?",
  stop: "Stop the field receiver for all projects?",
  issue:
    "Compare the installation ID and public key fingerprint on the physical device. Sign this installation?",
  enroll: "Apply this signed installation to the displayed device?",
  complete: "Confirm installation on the physical device and activate this assignment?",
  revoke: "Revoke this field assignment?",
};

export function fieldDialogs({ parentWindow }) {
  if (!parentWindow || parentWindow.isDestroyed()) throw new Error("Gaia room window is closed");
  return {
    async choose(kind) {
      const file = kind === "csr" || kind === "package";
      const result = await dialog.showOpenDialog(parentWindow, {
        title: choices[kind],
        properties: [file ? "openFile" : "openDirectory", "dontAddToRecent"],
        ...(file ? { filters: [{ name: "Gaia USB JSON", extensions: ["json"] }] } : {}),
      });
      return result.canceled ? undefined : result.filePaths[0];
    },
    async confirm(action, detail) {
      const result = await dialog.showMessageBox(parentWindow, {
        type: "question",
        title: "Gaia field administration",
        message: prompts[action],
        detail,
        buttons: ["Cancel", "Approve"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      return result.response === 1;
    },
    password() {
      // The native helper writes only to main's private pipe. Never include its stderr in IPC.
      return new Promise((resolve, reject) => {
        execFile(
          "/usr/bin/kdialog",
          ["--title", "Gaia field administration", "--password", "Unlock offline Gaia signing key"],
          { encoding: "buffer", timeout: 120000, maxBuffer: 4096 },
          (error, stdout) => {
            try {
              if (error?.code === 1) return resolve(undefined);
              if (error || !stdout.length || stdout[stdout.length - 1] !== 10)
                return reject(new Error("Gaia native password dialog unavailable"));
              resolve(Buffer.from(stdout.subarray(0, -1)));
            } finally {
              stdout.fill(0);
            }
          }
        );
      });
    },
  };
}
