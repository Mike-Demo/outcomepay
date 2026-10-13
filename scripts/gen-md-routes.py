#!/usr/bin/env python3
"""Regenerate functions/<name>.md.ts from public/<name>.md.

The SpaceFast edge does not serve .md files from the static export (404),
so the root markdown docs (auth.md, pricing.md, index.md, agents.md) are
served by tiny function routes whose bodies are generated from the public
.md sources. Edit the .md file, run this script, re-publish.
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
HEADER = """// GENERATED from public/{name}.md by scripts/gen-md-routes.py — edit the .md file, then re-run the script.
import {{ withErrors }} from "./_core/http";
const BODY = {body};
export const GET = withErrors(async () => new Response(BODY, {{ headers: {{ "Content-Type": "text/markdown; charset=utf-8" }} }}));
"""
for name in ["auth", "pricing", "index", "agents"]:
    text = (ROOT / "public" / f"{name}.md").read_text()
    (ROOT / "functions" / f"{name}.md.ts").write_text(HEADER.format(name=name, body=json.dumps(text)))
    print(f"functions/{name}.md.ts <- public/{name}.md ({len(text)} chars)")
