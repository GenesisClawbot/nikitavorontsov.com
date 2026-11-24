#!/usr/bin/env python3
"""Persistent tool loop for film and creative coding experiments."""
import argparse
import base64
import fcntl
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
BLENDER_MAC = "/Applications/Blender.app/Contents/MacOS/Blender"
SYSTEM = """Make the requested experiment inside your project. Work iteratively.
Use read_file and write_file to inspect and revise source, splitting large files
across turns. For Blender, write a Python script and call blender with script
and output paths. The script must produce the named file within its working
directory. The absolute output path is passed as the final argv item. Blender source requires operator review before execution. Inspect
rendered PNGs with inspect_png. Use finish to deliver a verified artifact.
Do not request credentials, make network calls from scripts, or install packages.
Source and media remain local except for previews you explicitly inspect here."""

SCHEMAS = {
    "list_files": ("List up to 100 project files.", {}),
    "read_file": ("Read a slice of a UTF-8 source file.", {"path": str, "offset": int}),
    "write_file": ("Write complete source, or append the next chunk.", {"path": str, "text": str, "append": bool}),
    "blender": ("Render using a reviewed Blender Python script.", {"script": str, "output": str}),
    "inspect_png": ("See a rendered PNG of at most 1 MB.", {"path": str}),
    "finish": ("Deliver an existing non-empty artifact and a summary.", {"path": str, "summary": str}),
}
TYPES = {str: "string", int: "integer", bool: "boolean"}
TOOLS = [
    {"type": "function", "function": {
        "name": name, "description": description,
        "parameters": {"type": "object", "properties": {
            key: {"type": TYPES[typ]} for key, typ in fields.items()},
            "required": list(fields), "additionalProperties": False},
    }}
    for name, (description, fields) in SCHEMAS.items()
]


def save(path, data):
    temp = path.with_suffix(".tmp")
    with temp.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)
        file.flush()
        os.fsync(file.fileno())
    temp.replace(path)


def project_path(project, name):
    rel = Path(name)
    if rel.is_absolute() or ".." in rel.parts or not rel.parts:
        raise ValueError("Use a path relative to the project.")
    target = project / rel
    if not target.resolve().is_relative_to(project.resolve()):
        raise ValueError("Path escapes the project.")
    if any(p.is_symlink() for p in [target, *target.parents] if p != project and project in p.parents):
        raise ValueError("Symlinks are not supported in tool paths.")
    return target


def source_digest(project):
    files = [(p.relative_to(project).as_posix(), hashlib.sha256(p.read_bytes()).hexdigest())
             for p in sorted(project.rglob("*")) if p.is_file() and not p.is_symlink()]
    return hashlib.sha256(json.dumps(files).encode()).hexdigest()


def provider(payload):
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise ValueError("Set OPENROUTER_API_KEY before starting live inference.")
    request = urllib.request.Request(ENDPOINT, data=json.dumps(payload).encode(), headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json",
    })
    with urllib.request.urlopen(request, timeout=180) as response:
        return json.load(response)


def parse_call(call):
    name = call["function"]["name"]
    args = json.loads(call["function"]["arguments"])
    fields = SCHEMAS[name][1]
    if not isinstance(args, dict) or args.keys() != fields.keys():
        raise ValueError("Arguments do not match tool schema.")
    if any(type(args[key]) is not typ for key, typ in fields.items()):
        raise ValueError("Incorrect tool argument type.")
    return name, args


def blender_path():
    return os.environ.get("BLENDER_BIN") or shutil.which("blender") or BLENDER_MAC


def execute_tool(project, name, args):
    if name == "list_files":
        return [p.relative_to(project).as_posix() for p in sorted(project.rglob("*"))
                if p.is_file() and not p.is_symlink()][:100], None
    if name == "blender":
        script = project_path(project, args["script"])
        output = project_path(project, args["output"])
        if script.suffix != ".py" or output.exists():
            raise ValueError("Use a Python script and a fresh output path for each render.")
        output.parent.mkdir(parents=True, exist_ok=True)
        # Do not pass model/API credentials through the subprocess environment.
        env = {key: os.environ[key] for key in ("HOME", "PATH", "LANG", "TMPDIR") if key in os.environ}
        completed = subprocess.run(
            [blender_path(), "--background", "--factory-startup", "--disable-autoexec",
             "--python-exit-code", "1", "--python", str(script), "--", str(output)],
            cwd=project, env=env, capture_output=True, text=True, timeout=300,
        )
        if completed.returncode or not output.is_file() or not output.stat().st_size:
            return {"error": "Blender did not produce the requested artifact.",
                    "log": (completed.stdout + completed.stderr)[-4000:]}, None
        return {"path": args["output"], "bytes": output.stat().st_size}, None
    path = project_path(project, args["path"])
    if name == "read_file":
        start = args["offset"]
        if start < 0 or path.stat().st_size > 1_000_000:
            raise ValueError("Use a non-negative offset and a source file under 1 MB.")
        source = path.read_text()
        return {"text": source[start:start+12000], "next_offset": min(start+12000, len(source)),
                "eof": start+12000 >= len(source)}, None
    if name == "write_file":
        if path.suffix.lower() not in {".py", ".html", ".css", ".js", ".mjs", ".json", ".md", ".txt", ".vtt"}:
            raise ValueError("Use a supported text or source extension.")
        if len(args["text"].encode()) > 100_000:
            raise ValueError("Write smaller chunks across turns.")
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("a" if args["append"] else "w", encoding="utf-8") as file:
            file.write(args["text"])
        return {"path": args["path"], "bytes": path.stat().st_size}, None
    if name == "inspect_png":
        if path.suffix.lower() != ".png" or path.stat().st_size > 1_000_000:
            raise ValueError("Preview must be a PNG no larger than 1 MB.")
        image = path.read_bytes()
        if not image.startswith(b"\x89PNG\r\n\x1a\n"):
            raise ValueError("Invalid PNG header.")
        return {"preview": args["path"]}, "data:image/png;base64," + base64.b64encode(image).decode()
    if name == "finish":
        if not path.is_file() or not path.stat().st_size:
            raise ValueError("The final artifact must exist and contain data.")
        return {"artifact": args["path"], "summary": args["summary"]}, None
    raise ValueError("Unknown tool.")


def run(folder, request=provider, approval=None, tool=execute_tool):
    project = (folder / "project").resolve()
    state_path = folder / "state.json"
    with (folder / ".lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state = json.loads(state_path.read_text())
        while True:
            if state["phase"] in {"finished", "model_finished"}:
                return state["phase"]
            if state["phase"] in {"request_in_flight", "tool_in_flight"}:
                raise RuntimeError("Previous operation has an unknown outcome. Inspect the checkpoint before any replay.")
            if state["phase"] == "ready":
                if state["turn"] >= state["limit"]:
                    return "turn_limit"
                payload = {"model": state["model"], "messages": state["messages"],
                           "tools": TOOLS, "parallel_tool_calls": False}
                if state["reasoning"]:
                    payload["reasoning"] = {"effort": state["reasoning"]}
                if state["max_tokens"]:
                    payload["max_tokens"] = state["max_tokens"]
                turn = state["turn"] + 1
                save(folder / f"request-{turn:03}.json", payload)
                state["phase"] = "request_in_flight"
                save(state_path, state)
                response = request(payload)
                save(folder / f"response-{turn:03}.json", response)
                message = response["choices"][0]["message"]
                # Retain reasoning_details verbatim for providers that require it
                # on the next round trip after a tool call.
                message = {k: message[k] for k in ("role", "content", "reasoning_details", "tool_calls") if k in message}
                message.setdefault("role", "assistant")
                state["messages"].append(message)
                state.update(turn=turn, pending=list(message.get("tool_calls") or []), previews=[],
                             phase="tools" if message.get("tool_calls") else "model_finished")
                save(state_path, state)
                continue
            if not state["pending"]:
                if state["previews"]:
                    state["messages"].append({"role": "user", "content": state["previews"]})
                state.update(phase="finished" if state.get("delivery") else "ready", previews=[])
                save(state_path, state)
                continue
            call = state["pending"][0]
            image = None
            name = None
            try:
                name, args = parse_call(call)
                if name == "blender":
                    script = project_path(project, args["script"])
                    if script.suffix != ".py" or not script.is_file():
                        raise ValueError("Write an existing Blender Python script first.")
                    review_digest = source_digest(project)
                    if approval != review_digest:
                        state["review"] = {"digest": review_digest, "script": args["script"],
                                           "output": args["output"], "call_id": call["id"]}
                        save(state_path, state)
                        return "source_review"
                    approval = None
                state["phase"] = "tool_in_flight"
                save(state_path, state)
                result, image = tool(project, name, args)
            except (KeyError, ValueError, OSError, subprocess.TimeoutExpired) as error:
                result = {"error": str(error)}
            state["pending"].pop(0)
            state.pop("review", None)
            state["messages"].append({"role": "tool", "tool_call_id": call["id"],
                                      "content": json.dumps(result)})
            if image:
                state["previews"].extend([{"type": "text", "text": f"Preview of {args['path']}"},
                                          {"type": "image_url", "image_url": {"url": image}}])
            if name == "finish" and "artifact" in result:
                state["delivery"] = result
            state["phase"] = "tools"
            save(state_path, state)


def init(folder, model, brief, reasoning, limit, max_tokens):
    folder.mkdir(parents=True, exist_ok=False)
    (folder / "project").mkdir()
    save(folder / "state.json", {
        "model": model, "reasoning": reasoning, "limit": limit, "max_tokens": max_tokens,
        "turn": 0, "phase": "ready", "pending": [], "previews": [],
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": brief}],
    })


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    start = commands.add_parser("init")
    start.add_argument("folder", type=Path)
    start.add_argument("--brief", type=Path, required=True)
    start.add_argument("--model", required=True)
    start.add_argument("--reasoning", choices=("minimal", "low", "medium", "high", "xhigh"))
    start.add_argument("--turns", type=int, default=30)
    start.add_argument("--max-tokens", type=int)
    resume = commands.add_parser("run")
    resume.add_argument("folder", type=Path)
    resume.add_argument("--approve")
    for name in ("status",):
        commands.add_parser(name).add_argument("folder", type=Path)
    args = parser.parse_args()
    folder = args.folder.resolve()
    if args.command == "init":
        if args.turns <= 0 or (args.max_tokens is not None and args.max_tokens <= 0):
            parser.error("Token and turn limits must be positive.")
        init(folder, args.model, args.brief.read_text(), args.reasoning, args.turns, args.max_tokens)
        return
    state = json.loads((folder / "state.json").read_text())
    if args.command == "run":
        if state["phase"] not in {"finished", "model_finished"} and not os.environ.get("OPENROUTER_API_KEY"):
            parser.error("Set OPENROUTER_API_KEY before running.")
        print(run(folder, approval=args.approve))
        state = json.loads((folder / "state.json").read_text())
    print(json.dumps({k: state[k] for k in ("phase", "turn", "review", "delivery") if k in state}, indent=2))


if __name__ == "__main__":
    main()
