#!/usr/bin/env python3
"""
Gaia Diagnostic — temporary test receiver.
Listens on 127.0.0.1:7701, accepts JSON observation lines from the
ADB-reversed J701F connection, records arrival time, and responds.

Usage:
    python3 test_receiver.py [--port 7701] [--log out.jsonl]

IMPORTANT: This is a one-shot feasibility experiment server.
Shut it down when the experiment is done (Ctrl-C or kill the process).
"""

import argparse
import json
import socket
import sys
import time
from datetime import datetime, timezone


def handle_client(conn, addr, log_file):
    with conn:
        arrival_wall = time.time()
        arrival_iso = datetime.fromtimestamp(arrival_wall, tz=timezone.utc).isoformat()
        try:
            data = b""
            while True:
                chunk = conn.recv(4096)
                if not chunk:
                    break
                data += chunk
                if b"\n" in data:
                    break
            raw = data.decode("utf-8", errors="replace").strip()
            if not raw:
                return
            try:
                obs = json.loads(raw)
            except json.JSONDecodeError as e:
                print(f"[{arrival_iso}] JSON parse error: {e} | raw={raw[:200]}", flush=True)
                conn.sendall(b'{"ok":false,"error":"json_parse"}\n')
                return

            device_wall = obs.get("deviceWallMs")
            device_mono = obs.get("deviceMonotonicMs")
            diff_ms = None
            if isinstance(device_wall, (int, float)):
                diff_ms = round(arrival_wall * 1000 - device_wall)

            record = {
                "serverArrivalIso": arrival_iso,
                "serverArrivalMs": round(arrival_wall * 1000),
                "deviceWallMs": device_wall,
                "deviceMonotonicMs": device_mono,
                "clockDiffMs": diff_ms,
                "obs": obs,
            }

            line = json.dumps(record, ensure_ascii=False)
            print(f"[{arrival_iso}] clockDiff={diff_ms}ms bat={obs.get('batteryPct')}% "
                  f"temp={obs.get('batteryTempC')}°C "
                  f"accel={obs.get('accel')} prox={obs.get('proxCm')}cm", flush=True)

            if log_file:
                log_file.write(line + "\n")
                log_file.flush()

            conn.sendall(b'{"ok":true}\n')
        except Exception as e:
            print(f"handle_client error: {e}", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=7701)
    parser.add_argument("--log", type=str, default="diagnostic_obs.jsonl",
                        help="JSONL log file path")
    args = parser.parse_args()

    log_file = None
    if args.log:
        log_file = open(args.log, "a", encoding="utf-8")

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as srv:
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(("127.0.0.1", args.port))
        srv.listen(5)
        print(f"Gaia Diagnostic test receiver listening on 127.0.0.1:{args.port}", flush=True)
        print(f"Logging to: {args.log}", flush=True)
        print("Press Ctrl-C to stop.\n", flush=True)
        try:
            while True:
                conn, addr = srv.accept()
                handle_client(conn, addr, log_file)
        except KeyboardInterrupt:
            print("\nReceiver stopped.", flush=True)
        finally:
            if log_file:
                log_file.close()


if __name__ == "__main__":
    main()
