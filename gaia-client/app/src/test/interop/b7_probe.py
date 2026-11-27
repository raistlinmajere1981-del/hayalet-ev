"""Measure the production Electron receiver using a disposable B7 Client APK on SM-J701F."""
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlsplit

serial, apk_directory = sys.argv[1:]
app = "com.hayaletev.gaiaclient.b7probe"
repo = Path(__file__).resolve().parents[5]
apk = Path(apk_directory)


def device(*args, data=None):
    return subprocess.check_output(["adb", "-s", serial, *args], input=data, timeout=70)


def instrument(action):
    result = device("shell", "am", "instrument", "-w", "-e", "action", action,
                    app + ".test/com.hayaletev.gaiaclient.B7Probe").decode()
    if "INSTRUMENTATION_CODE: -1" not in result:
        raise RuntimeError(result)
    print(result.strip(), flush=True)


if device("shell", "getprop", "ro.product.model").strip() != b"SM-J701F":
    raise SystemExit("Select the SM-J701F")
if device("shell", "pm", "list", "packages", app).strip():
    raise SystemExit("The disposable package name is already in use")
if abs(int(device("shell", "date", "+%s")) - time.time()) > 120:
    raise SystemExit("Device clock outside the field certificate window")

installed = []
original_reverse = device("reverse", "--list")
local_port = None
try:
    for package, path in [(app, "debug/app-debug.apk"), (app + ".test", "androidTest/debug/app-debug-androidTest.apk")]:
        device("install", str(apk / path))
        installed.append(package)
    with tempfile.TemporaryDirectory(prefix="gaia-b7-usb-") as io:
        folder = Path(io)
        instrument("request")
        (folder / "request.json").write_bytes(device("exec-out", "run-as", app, "cat", "cache/request.json"))
        with subprocess.Popen(["node", "--import", "tsx", "scripts/tests/gaia-field.electron-smoke.mjs", io],
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, cwd=repo) as center:
            reverse = None
            try:
                if center.stdout.readline() != b"ready\n":
                    raise RuntimeError("Synthetic Electron listener did not start")
                for name in ["package.json", "pin"]:
                    device("shell", "-T", "run-as", app, "sh", "-c", f"'cat > cache/{name}'",
                           data=(folder / name).read_bytes())
                origin = json.loads((folder / "package.json").read_bytes())["approval"]["httpsOrigin"]
                local_port = urlsplit(origin).port
                port = f"tcp:{local_port}"
                device("reverse", "--no-rebind", port, port)
                reverse = port
                issued = int(time.time())
                deadline = time.monotonic() + 125
                while int(device("shell", "date", "+%s")) < issued:
                    if time.monotonic() >= deadline:
                        raise RuntimeError("Device clock did not reach issuance")
                    time.sleep(1)
                instrument("measure")
                center.stdin.write(b"measure\n")
                center.stdin.flush()
                measurement = json.loads(center.stdout.readline())
                print(json.dumps(measurement, ensure_ascii=False), flush=True)
            finally:
                try:
                    if reverse:
                        device("reverse", "--remove", reverse)
                finally:
                    center.stdin.close()
                    if center.wait(timeout=25):
                        raise RuntimeError("Electron measurement did not exit cleanly")
finally:
    if app in installed:
        device("shell", "am", "force-stop", app)
    for package in reversed(installed):
        device("uninstall", package)

assert not device("shell", "pm", "list", "packages", app).strip()
assert b"ServiceRecord" not in device("shell", "dumpsys", "activity", "services", app)
assert device("reverse", "--list") == original_reverse
if local_port:
    with socket.socket() as check:
        assert check.connect_ex(("127.0.0.1", local_port)) != 0
print("Verified listener, reverse, disposable pairing/packages and service cleanup")
