#!/usr/bin/env python3
"""Disk Map: find out what's filling your Mac and build a cleanup script.

Scans your home folder, spots caches and build junk that are safe to delete,
and opens an interactive map in your browser. Nothing is deleted by this
script. You pick items in the page and copy a cleanup script to run yourself.

    python3 diskmap.py              # scan ~ and open the report
    python3 diskmap.py --demo       # open the report with sample data
    python3 diskmap.py --out x.html --no-open
"""
import argparse
import datetime
import glob
import json
import os
import shutil
import stat
import sys
import time
import webbrowser

HERE = os.path.dirname(os.path.abspath(__file__))
KEEP_DEPTH = 6          # tree depth kept for the map
SIZE_DEPTH = 6          # folder depth whose sizes we remember for rules
DAY = 86400
GB = 1e9
MB = 1e6

# Folders whose insides don't matter for the map.
OPAQUE = {"node_modules", ".git", ".next", ".turbo", "__pycache__", ".venv", "venv", "DerivedData"}
PROJECT_MARKERS = {"package.json", ".git", "pyproject.toml", "Cargo.toml", "build.gradle", "go.mod", "Gemfile"}

# id, title, safety, paths (relative to ~), note, optional commands
RULES = [
    ("npm", "npm cache", "safe", [".npm"],
     "Packages npm downloaded once. It fetches them again when a project needs them."),
    ("yarn", "Yarn cache", "safe", ["Library/Caches/Yarn", ".yarn/berry/cache", ".cache/yarn"],
     "Yarn's download cache. Refilled on the next install."),
    ("pnpm", "pnpm store", "safe", ["Library/pnpm/store", ".pnpm-store", ".local/share/pnpm/store"],
     "pnpm's shared package store. Refilled on the next install."),
    ("bun", "Bun cache", "safe", [".bun/install/cache"],
     "Bun's package cache. Refilled on the next install."),
    ("gradle", "Gradle caches", "safe", [".gradle/caches", ".gradle/wrapper/dists"],
     "Downloaded Gradle dependencies and build cache. Re-downloaded on the next Android build."),
    ("deriveddata", "Xcode DerivedData", "safe", ["Library/Developer/Xcode/DerivedData"],
     "Xcode's build products and indexes. Xcode rebuilds them. Quit Xcode first."),
    ("toolcache", "Python & browser tool caches",  "safe",
     [".cache/uv", "Library/Caches/uv", ".cache/pip", "Library/Caches/pip", ".cache/puppeteer",
      "Library/Caches/ms-playwright", ".cache/ms-playwright", ".cache/pre-commit"],
     "uv, pip, Puppeteer and Playwright downloads. Fetched again on demand."),
    ("homebrew", "Homebrew downloads", "safe", ["Library/Caches/Homebrew"],
     "Old installer downloads. Homebrew doesn't need them after installing."),
    ("cocoapods", "CocoaPods cache", "safe", ["Library/Caches/CocoaPods"],
     "Pod downloads. Re-fetched on the next pod install."),
    ("gocache", "Go build cache", "safe", ["Library/Caches/go-build"],
     "Compiled Go packages. Rebuilt as needed."),
    ("trash", "Trash", "safe", [".Trash"],
     "Files you've already deleted. Emptying the Trash makes it permanent.",
     ['find "$HOME/.Trash" -mindepth 1 -delete 2>/dev/null || osascript -e \'tell application "Finder" to empty trash\'']),
    ("android", "Android SDK & emulators", "review", ["Library/Android/sdk", ".android/avd"],
     "Only remove if you no longer build Android apps. Android Studio can reinstall it."),
    ("simulators", "iOS simulators", "review", ["Library/Developer/CoreSimulator"],
     "Removes simulators for iOS versions Xcode no longer has. Safe if you don't need old iOS versions.",
     ["xcrun simctl delete unavailable"]),
    ("devicesupport", "iOS DeviceSupport", "review", ["Library/Developer/Xcode/iOS DeviceSupport"],
     "Debug symbols for every iPhone OS version you've plugged in. Xcode re-creates them when you connect a device."),
    ("docker", "Docker images & volumes", "review", ["Library/Containers/com.docker.docker"],
     "Removes stopped containers, unused images and build cache. Volumes with data are kept.",
     ["docker system prune -a -f"]),
    ("ai-other", "Other local AI models", "review",
     [".cache/huggingface", ".lmstudio/models", ".cache/lm-studio/models"],
     "Hugging Face and LM Studio downloads. Delete models you no longer use."),
]


def human(b):
    if b >= GB:
        return f"{b / GB:.1f} GB"
    return f"{round(b / MB)} MB"


def shq(rel):
    """Quote a path under $HOME for bash."""
    esc = rel.replace("\\", "\\\\").replace('"', '\\"').replace("$", "\\$").replace("`", "\\`")
    return f'"$HOME/{esc}"'


class Scanner:
    def __init__(self, root):
        self.root = root
        self.dev = os.lstat(root).st_dev
        self.seen = set()
        self.sizes = {}
        self.finds = []       # (kind, rel, size, extra)
        self.dirs = 0
        self.denied = 0
        self.started = time.time()
        self.last_tick = 0

    def tick(self, rel):
        now = time.time()
        if now - self.last_tick > 0.25 and sys.stderr.isatty():
            self.last_tick = now
            shown = ("~/" + rel)[:60]
            sys.stderr.write(f"\r  scanning {self.dirs:>7,} folders  {shown:<60}")
            sys.stderr.flush()

    def walk(self, path, rel, depth, opaque=False, in_nm=False):
        """Return (bytes, node). node is None below KEEP_DEPTH or inside opaque folders."""
        self.dirs += 1
        self.tick(rel)
        try:
            with os.scandir(path) as it:
                entries = list(it)
        except OSError:
            self.denied += 1
            return 0, None

        names = {e.name for e in entries}
        is_project = bool(names & PROJECT_MARKERS)
        keep = depth < KEEP_DEPTH and not opaque
        total = files = nfiles = 0
        kids = []
        newest = 0

        for e in entries:
            try:
                st = e.stat(follow_symlinks=False)
            except OSError:
                continue
            mode = st.st_mode
            if stat.S_ISLNK(mode):
                continue
            crel = f"{rel}/{e.name}" if rel else e.name
            if stat.S_ISDIR(mode):
                if st.st_dev != self.dev:
                    continue  # another volume
                if e.name not in OPAQUE:
                    newest = max(newest, st.st_mtime)
                child_opaque = opaque or e.name in OPAQUE
                s, node = self.walk(e.path, crel, depth + 1, child_opaque, in_nm or e.name == "node_modules")
                total += s
                if depth + 1 <= SIZE_DEPTH:
                    self.sizes[crel] = s
                if keep and node is not None:
                    kids.append(node)
                elif keep:
                    kids.append({"n": e.name, "s": s})
                if not in_nm:
                    self.detect(e.name, rel, crel, s, is_project)
            else:
                if st.st_nlink > 1:
                    key = (st.st_dev, st.st_ino)
                    if key in self.seen:
                        continue
                    self.seen.add(key)
                b = st.st_blocks * 512
                total += b
                files += b
                nfiles += 1
                newest = max(newest, st.st_mtime)
                if rel == "Downloads" and b >= 100 * MB:
                    last = max(st.st_mtime, getattr(st, "st_atime", 0))
                    if time.time() - last > 90 * DAY:
                        self.finds.append(("download", crel, b, {}))

        if is_project:
            for kind, prel, s, extra in self.finds:
                if kind == "node_modules" and extra.get("project") == rel:
                    extra["idle_days"] = (time.time() - newest) / DAY if newest else 0

        if not keep:
            return total, None
        if files:
            kids.append({"n": f"{nfiles} loose file{'s' if nfiles != 1 else ''}", "s": files, "x": 1})
        node = {"n": os.path.basename(rel) or "~", "s": total}
        if kids:
            node["c"] = kids
        if is_project:
            node["p"] = 1
        return total, node

    def detect(self, name, parent_rel, rel, size, parent_is_project):
        if name == "node_modules" and parent_is_project:
            self.finds.append(("node_modules", rel, size, {"project": parent_rel}))
        elif name in (".next", ".turbo") and parent_is_project:
            self.finds.append(("build", rel, size, {}))
        elif name == "worktrees" and parent_rel.endswith(".claude"):
            project = parent_rel[: -len(".claude")].rstrip("/")
            self.finds.append(("worktrees", rel, size, {"project": project}))


def prune(node, min_size):
    kids = node.get("c")
    if not kids:
        node.pop("c", None)
        return
    kids.sort(key=lambda k: -k["s"])
    keep = [k for k in kids[:40] if k["s"] >= min_size and not k.get("x")]
    rest = [k for k in kids if k not in keep]
    rest_size = sum(k["s"] for k in rest)
    if rest_size > 0:
        if len(rest) == 1 and rest[0].get("x"):
            keep.append(rest[0])
        else:
            count = sum(1 for k in rest)
            keep.append({"n": f"{count} smaller item{'s' if count != 1 else ''}", "s": rest_size, "x": 1})
    node["c"] = keep
    for k in keep:
        prune(k, min_size)


def ollama_models(home):
    """Return [(name:tag, bytes)] from Ollama's manifests."""
    out = []
    base = os.path.join(home, ".ollama/models/manifests")
    for path in glob.glob(os.path.join(base, "*/*/*/*")):
        try:
            with open(path) as f:
                m = json.load(f)
        except (OSError, ValueError):
            continue
        parts = os.path.relpath(path, base).split(os.sep)
        host, ns, model, tag = parts
        name = f"{model}:{tag}" if ns == "library" else f"{ns}/{model}:{tag}"
        if host != "registry.ollama.ai":
            name = f"{host}/{ns}/{model}:{tag}"
        size = sum(l.get("size", 0) for l in m.get("layers", [])) + m.get("config", {}).get("size", 0)
        out.append((name, size))
    return sorted(out, key=lambda x: -x[1])


def build_items(sc, home):
    items = []

    def add(id, title, safety, paths, note, cmd=None, where=None, parts=None):
        paths = [{"p": p, "s": s} for p, s in paths if s >= 1 * MB]
        if not paths:
            return
        it = {"id": id, "title": title, "safety": safety, "paths": paths, "note": note}
        if cmd:
            it["cmd"] = cmd
        if where:
            it["where"] = where
        if parts:
            it["parts"] = [{"p": p, "s": s} for p, s in parts]
        items.append(it)

    for rule in RULES:
        id, title, safety, rels, note = rule[:5]
        cmd = rule[5] if len(rule) > 5 else None
        add(id, title, safety, [(r, sc.sizes.get(r, 0)) for r in rels], note, cmd)

    models = ollama_models(home)
    oll = sc.sizes.get(".ollama/models", 0)
    if oll:
        cmd = [f"ollama rm {shq_name(n)}" for n, _ in models] or None
        add("ollama", "Ollama models", "review", [(".ollama/models", oll)],
            "Local AI models. Remove the ones you don't use and pull them again later if needed.",
            cmd, "~/.ollama/models", models or None)

    builds = [(r, s) for k, r, s, _ in sc.finds if k == "build"]
    add("build", "Next.js & Turbo build output", "safe", builds,
        "Rebuilt automatically the next time you run dev or build.", where=summarise(builds, ".next, .turbo"))

    wts = [(r, s, x["project"]) for k, r, s, x in sc.finds if k == "worktrees"]
    if wts:
        cmd = []
        for r, s, proj in wts:
            cmd += [f"rm -rf {shq(r)}", f"git -C {shq(proj) if proj else '$HOME'} worktree prune"]
        add("worktrees", "Claude Code worktrees", "review", [(r, s) for r, s, _ in wts],
            "Extra copies of a repo made for parallel agent work. Check nothing unmerged is left in them.",
            cmd, summarise([(r, s) for r, s, _ in wts], "worktrees"))

    idle = [(r, s) for k, r, s, x in sc.finds if k == "node_modules" and x.get("idle_days", 0) > 30]
    add("nodemods", "node_modules in idle projects", "review", idle,
        "Projects with no changes in 30+ days. Run npm install in a project to bring them back.",
        where=f"{len(idle)} project{'s' if len(idle) != 1 else ''} untouched for 30+ days")

    dls = [(r, s) for k, r, s, _ in sc.finds if k == "download"]
    add("downloads", "Large old downloads", "review", dls,
        "Files over 100 MB in Downloads that you haven't opened in 90 days.", where="~/Downloads, 90+ days old")

    # A path can only belong to one item: drop any path that sits inside another item's path.
    pairs = sorted(((p["p"], it) for it in items for p in it["paths"]), key=lambda x: len(x[0]))
    kept = []
    for p, it in pairs:
        if any(p == k or p.startswith(k + "/") for k, _ in kept):
            it["paths"] = [x for x in it["paths"] if x["p"] != p]
        else:
            kept.append((p, it))
    items = [it for it in items if it["paths"]]
    for it in items:
        it["size"] = sum(p["s"] for p in it["paths"])
    return [it for it in items if it["size"] >= 20 * MB]


def shq_name(name):
    return "'" + name.replace("'", "'\\''") + "'"


def summarise(paths, tail):
    if not paths:
        return None
    if len(paths) == 1:
        return "~/" + paths[0][0]
    tops = sorted({p.split("/")[0] for p, _ in paths})
    return f"{len(paths)} folders in ~/{', ~/'.join(tops[:2])}{'…' if len(tops) > 2 else ''} ({tail})"


def render(data, out):
    with open(os.path.join(HERE, "template.html")) as f:
        tpl = f.read()
    blob = json.dumps(data, separators=(",", ":")).replace("</", "<\\/")
    page = tpl.replace("/*__DATA__*/null", blob, 1)
    head = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head><body>\n'
    with open(out, "w") as f:
        f.write(head + page + "\n</body></html>\n")


def main():
    ap = argparse.ArgumentParser(description="Map your disk and find junk to clean up.")
    ap.add_argument("--root", default=os.path.expanduser("~"), help="folder to scan (default: your home folder)")
    ap.add_argument("--out", default=os.path.join(HERE, "diskmap-report.html"), help="where to write the report")
    ap.add_argument("--no-open", action="store_true", help="don't open the report in a browser")
    ap.add_argument("--demo", action="store_true", help="skip the scan and show sample data")
    args = ap.parse_args()
    sys.setrecursionlimit(10000)

    if args.demo:
        render(None, args.out)
    else:
        home = os.path.abspath(args.root)
        print(f"Scanning {home} (this can take a minute or two)…", file=sys.stderr)
        sc = Scanner(home)
        total, tree = sc.walk(home, "", 0)
        tree["n"] = "~"
        prune(tree, max(total * 0.0008, 5 * MB))
        items = build_items(sc, home)
        du = shutil.disk_usage(home)
        data = {
            "home": home,
            "scannedAt": datetime.datetime.now().astimezone().isoformat(),
            "disk": {"total": du.total, "free": du.free, "used": du.total - du.free},
            "tree": tree,
            "items": items,
        }
        render(data, args.out)
        sys.stderr.write("\r" + " " * 90 + "\r")
        safe = sum(i["size"] for i in items if i["safety"] == "safe")
        review = sum(i["size"] for i in items if i["safety"] == "review")
        print(f"Scanned {human(total)} in {sc.dirs:,} folders ({time.time() - sc.started:.0f}s).")
        print(f"  Safe to remove: {human(safe)}   Needs review: {human(review)}")
        if sc.denied:
            print(f"  {sc.denied:,} folders were off-limits. For a full scan, give Terminal Full Disk Access "
                  "in System Settings > Privacy & Security.")

    print(f"Report: {args.out}")
    if not args.no_open:
        webbrowser.open("file://" + os.path.abspath(args.out))


if __name__ == "__main__":
    main()
