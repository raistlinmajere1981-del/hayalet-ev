"""Run the targeted B6 measurement with the debug and instrumentation APKs installed."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlsplit

app = "com.hayaletev.gaiaclient"
runner = f"{app}.test/{app}.KeystoreProbe"
adb = ["adb", "-s", sys.argv[1]]
repo = Path(__file__).resolve().parents[5]


def device(*args, data=None):
    return subprocess.check_output([*adb, *args], input=data)


def measure(action):
    report = device("shell", "am", "instrument", "-w", "-e", "action", action, runner).decode()
    if "INSTRUMENTATION_CODE: -1" not in report:
        raise RuntimeError(report)
    print(report.strip(), flush=True)


if device("shell", "getprop", "ro.product.model").strip() != b"SM-J701F":
    raise SystemExit("This measurement requires the SM-J701F")

measure("resolve")
with tempfile.TemporaryDirectory(prefix="gaia-b6-probe-") as tmp:
    folder = Path(tmp)
    measure("request")
    try:
        (folder / "request.json").write_bytes(device("exec-out", "run-as", app, "cat", "cache/b6-probe/request.json"))
        with subprocess.Popen(
            ["node", "--import", "tsx", str(Path(__file__).with_name("center.mts")), tmp],
            cwd=repo, stdin=subprocess.PIPE, stdout=subprocess.PIPE
        ) as center:
            reverse = None
            try:
                if center.stdout.readline() != b"ready\n":
                    raise RuntimeError("B3/2 did not issue the installation")
                print("B3/2 verified the SM-J701F CSR and issued its synthetic package", flush=True)
                for name in ("package.json", "pin"):
                    device("shell", "-T", "run-as", app, "sh", "-c", f"'cat > cache/b6-probe/{name}'",
                           data=(folder / name).read_bytes())
                if abs(int(device("shell", "date", "+%s")) - time.time()) < 120:
                    origin = json.loads((folder / "package.json").read_bytes())["approval"]["httpsOrigin"]
                    port = f"tcp:{urlsplit(origin).port}"
                    device("reverse", "--no-rebind", port, port)
                    reverse = port
                # Manual minute-resolution clock setting can leave a small
                # lag. Wait for the newly issued certificates to become valid
                # on the device; do not backdate or bypass verification.
                if reverse:
                    issued = int(time.time())
                    until = time.monotonic() + 125
                    while int(device("shell", "date", "+%s")) < issued:
                        if time.monotonic() >= until:
                            raise RuntimeError("Device clock did not reach issuance time")
                        time.sleep(1)
                measure("verify")
            finally:
                try:
                    if reverse:
                        device("reverse", "--remove", reverse)
                finally:
                    center.stdin.close()
                    center.wait(timeout=10)
    finally:
        measure("clean")
