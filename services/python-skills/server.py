#!/usr/bin/env python3
"""Rangeform's opt-in, isolated Python research-skill service.

Only explicitly enumerated *read-only* or *hypothetical* commands are allowed.
This is NOT an order router: broker approve/result/fill/flatten commands are
not addressable from this server. All per-request trader files are ephemeral.
"""
from __future__ import annotations

import hmac
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]
SKILLS = ROOT / "local-toolkit" / "research"
SKILL_FILES = {
    "scanner": ("trader-scanner", "scan.py"),
    "news": ("trader-news", "news.py"),
    "entry": ("trader-entry", "entry.py"),
    "exit": ("trader-exit", "exit.py"),
    "timemachine": ("trader-timemachine", "timemachine.py"),
    "budget": ("trader-budget", "size.py"),
    "risk": ("trader-risk", "check.py"),
    "broker": ("trader-broker", "ticket.py"),
    "alerts": ("trader-alerts", "alerts.py"),
    "analyst": ("trader-analyst", "facts.py"),
    "pelosi": ("trader-pelosi", "ptr.py"),
}
MAX_BODY = 8192
MAX_OUTPUT = 30000
RUNNERS = threading.BoundedSemaphore(2)
SYMBOL = re.compile(r"^[A-Z][A-Z0-9.-]{0,9}$")
DATE = re.compile(r"^20[2-3][0-9]-[0-1][0-9]-[0-3][0-9]$")
CLOCK = re.compile(r"^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$")


class InputError(ValueError):
    pass


def one_symbol(data):
    value = str(data.get("symbol", "AAPL")).strip().upper()
    if not SYMBOL.fullmatch(value):
        raise InputError("Symbol must be an ordinary stock ticker, such as AAPL.")
    return value


def bounded_number(data, name, default, lo, hi, *, whole=False):
    raw = data.get(name, default)
    try:
        value = float(raw)
    except (TypeError, ValueError, OverflowError):
        raise InputError(f"{name} must be a number.") from None
    if not (lo <= value <= hi) or not __import__("math").isfinite(value):
        raise InputError(f"{name} must be between {lo} and {hi}.")
    if whole and value != int(value):
        raise InputError(f"{name} must be a whole number.")
    return int(value) if whole else value


def trade_input(data):
    entry = bounded_number(data, "entry", None, 0.01, 100000)
    stop = bounded_number(data, "stop", None, 0.01, 100000)
    target = bounded_number(data, "target", None, 0.01, 100000)
    if not stop < entry < target:
        raise InputError("Only hypothetical long cases with stop < entry < target are supported.")
    return entry, stop, target


def plan_data(symbol, data, entry, stop, target):
    date = str(data.get("date", datetime.utcnow().date().isoformat()))
    if not DATE.fullmatch(date):
        raise InputError("date must be YYYY-MM-DD.")
    time = str(data.get("entry_time", "10:15 AM"))
    if not CLOCK.fullmatch(time):
        raise InputError("entry_time must be like 10:15 AM.")
    distance = entry - stop
    return {
        "created_by": "rangeform-paper-research",
        "symbol": symbol, "side": "buy", "date": date,
        "setup": "level", "entry": entry, "entry_time": time,
        "stop": stop, "stop_rule": "price", "stop_label": "hypothetical entry invalidation",
        "target": target, "target_r": (target-entry)/distance,
        "risk_per_share": distance, "reward_risk": (target-entry)/distance,
        "flat_by": "15:55", "paper": True,
    }


def safe_command(skill, data, workspace):
    if not isinstance(data, dict) or not isinstance(skill, str) or skill not in SKILL_FILES:
        raise InputError("Unknown trading research skill.")
    symbol = one_symbol(data) if skill != "pelosi" else None
    script = SKILLS.joinpath(*SKILL_FILES[skill])
    if not script.is_file():
        raise RuntimeError("The original Python research tool is missing from the server image.")
    config = {"budget": 5000, "max_loss_per_trade_usd": 50, "max_daily_loss_usd": 150,
              "max_trades_per_day": 3, "cash_buffer_pct": 10, "max_position_pct": 75,
              "max_order_usd": 4000, "min_order_usd": 5, "min_reward_risk": 1.0,
              "no_entries_before": "09:45", "no_entries_after": "15:30",
              "require_stop": True, "paper": True, "allow_options": False,
              "allow_short": False, "allow_margin": False, "broker": "none"}
    path = Path(workspace) / "trader"
    path.mkdir(parents=True, exist_ok=True)
    (path / "state").mkdir(exist_ok=True)
    agent = os.environ.get("SEC_USER_AGENT", "").strip()
    if agent:
        config["sec_user_agent"] = agent
    (path / "config.json").write_text(json.dumps(config), encoding="utf-8")
    steps = []

    def add(s, args, *, valid_block=False):
        target = SKILLS.joinpath(*SKILL_FILES[s])
        steps.append((s, [sys.executable, str(target), *args], valid_block))

    if skill == "scanner":
        add(skill, ["daily", "--symbols", symbol, "--limit", "1", "--json", "--no-write"])
    elif skill == "news":
        args = ["--tickers", symbol, "--hours", "24", "--dry-run", "--json"]
        if not agent:
            args += ["--no-sec"]
        else:
            args += ["--user-agent", agent]
        add(skill, args)
    elif skill == "entry":
        add(skill, ["check", symbol, "--setup", "orb", "--json"])
    elif skill in ("exit", "timemachine", "budget", "risk", "broker"):
        entry, stop, target = trade_input(data)
        plan = plan_data(symbol, data, entry, stop, target)
        (path / "plan.json").write_text(json.dumps(plan), encoding="utf-8")
        if skill == "exit":
            add(skill, ["plan", "--symbol", symbol, "--setup", "level",
                        "--entry", str(entry), "--stop", f"price:{stop}",
                        "--target", f"price:{target}", "--json"])
        elif skill == "timemachine":
            add(skill, ["run", "--symbol", symbol, "--date", plan["date"],
                        "--entry", str(entry), "--stop", str(stop),
                        "--target", str(target), "--entry-time", plan["entry_time"],
                        "--replays", "10000", "--seed", "19", "--json"])
        else:
            budget = bounded_number(data, "budget", 5000, 100, 1000000)
            config["budget"] = budget
            (path / "config.json").write_text(json.dumps(config), encoding="utf-8")
            add("budget", ["--budget", str(budget), "--write", "trader/orders.json", "--json"])
            if skill in ("risk", "broker"):
                add("risk", ["--json", *([] if skill == "broker" else ["--no-write"])], valid_block=True)
            if skill == "broker":
                add("broker", ["show", "--json"])
    elif skill == "alerts":
        add(skill, ["quote", symbol, "--json"])
    elif skill == "analyst":
        if not agent:
            raise InputError("SEC_USER_AGENT must be configured by the server owner for SEC research.")
        add(skill, [symbol, "--user-agent", agent, "--json"])
    elif skill == "pelosi":
        add(skill, ["index", "--year", str(datetime.utcnow().year),
                    "--limit", "15", "--json"])
    # In particular, NEVER accept custom Python arguments, shell fragments,
    # offline fixture paths, broker approval/result, or uploaded commands.
    return steps


def run_skill(data, *, runner=subprocess.run):
    if not isinstance(data, dict):
        raise InputError("Expected a JSON object.")
    skill = data.get("skill")
    if not isinstance(skill, str) or skill not in SKILL_FILES:
        raise InputError("Select one of the 11 original research tools.")
    if not RUNNERS.acquire(blocking=False):
        return {"ok": False, "code": "BUSY", "error": "Research service is busy; retry later."}, 429
    try:
        with tempfile.TemporaryDirectory(prefix="rangeform-research-") as work:
            steps = safe_command(skill, data, work)
            outputs = []
            for name, cmd, valid_block in steps:
                try:
                    completed = runner(cmd, cwd=work, capture_output=True, text=True,
                                       timeout=65 if name == "timemachine" else 35, check=False,
                                       env={"PATH": os.environ.get("PATH", ""),
                                            "HOME": work,
                                            "SEC_USER_AGENT": os.environ.get("SEC_USER_AGENT", "")})
                except subprocess.TimeoutExpired:
                    return {"ok": False, "skill": skill, "code": "TIMEOUT",
                            "error": "Source request or calculation timed out. No result is claimed."}, 503
                stdout = (completed.stdout or "")[:MAX_OUTPUT]
                stderr = (completed.stderr or "")[:1000]
                try:
                    output = json.loads(stdout)
                except (ValueError, TypeError):
                    output = {"text": stdout}
                outputs.append({"tool": name, "exit_code": completed.returncode, "result": output,
                                "note": stderr if completed.returncode else ""})
                if completed.returncode and not valid_block:
                    return {"ok": False, "skill": skill, "code": "TOOL_UNAVAILABLE",
                            "steps": outputs, "paper_only": True,
                            "error": "The original Python tool could not complete. Verify data/market-hours/entitlements."}, 422
            return {"ok": True, "skill": skill, "steps": outputs, "paper_only": True,
                    "broker_orders": False, "persistent_portfolio": False,
                    "note": "Original read-only research tools. No broker connector, persistent journal or profit promise."}, 200
    finally:
        RUNNERS.release()


class Handler(BaseHTTPRequestHandler):
    server_version = "RangeformResearch/1"
    def reply(self, data, status=200):
        raw = json.dumps(data, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
    def do_GET(self):
        if urlsplit(self.path).path != "/health":
            return self.reply({"error": "Not found"}, 404)
        return self.reply({"service": "rangeform-python-skills",
                           "skills": sorted(SKILL_FILES),
                           "configured": bool(os.environ.get("SKILLS_SERVICE_TOKEN")),
                           "paper_only": True, "broker_orders": False})
    def do_POST(self):
        if urlsplit(self.path).path != "/run":
            return self.reply({"error": "Not found"}, 404)
        secret = os.environ.get("SKILLS_SERVICE_TOKEN", "")
        provided = self.headers.get("Authorization", "")
        if not secret:
            return self.reply({"error": "Service owner secret is not configured."}, 503)
        if not hmac.compare_digest(provided, "Bearer " + secret):
            return self.reply({"error": "Unauthorized"}, 401)
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.reply({"error": "Invalid request length"}, 400)
        if length < 1 or length > MAX_BODY:
            return self.reply({"error": "Request exceeds size limit"}, 413)
        try:
            value = json.loads(self.rfile.read(length).decode("utf-8"))
            data, code = run_skill(value)
        except (InputError, ValueError, UnicodeError) as exc:
            return self.reply({"error": str(exc), "broker_orders": False}, 400)
        except Exception:
            return self.reply({"error": "Research backend unavailable.", "broker_orders": False}, 503)
        return self.reply(data, code)
    def log_message(self, format, *args):
        # Only path + status; never write Authorization tokens to logs.
        sys.stderr.write("Rangeform skill API request: " + format % args + "\n")


if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8080"))
    ThreadingHTTPServer((host, port), Handler).serve_forever()
