#!/usr/bin/env python3
"""Offline verifier for OutcomePay hash-chained ledgers.

Usage: python3 scripts/verify-ledger.py ledger/<outcomeId>.json

Recomputes every hash link: hash = sha256(prev_hash + "|" + kind + "|" + canonical_json(payload)).
Mirrors functions/_core/ledger.ts canonicalization (sorted keys, no whitespace).
Exit 0 + "CHAIN INTACT" when every link checks out, else exit 1.
"""
import hashlib
import json
import sys

GENESIS = "0" * 64


def canonicalize(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return json.dumps(value, separators=(",", ":"))
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, list):
        return "[" + ",".join(canonicalize(v) for v in value) + "]"
    if isinstance(value, dict):
        items = ",".join(
            json.dumps(k, ensure_ascii=False, separators=(",", ":")) + ":" + canonicalize(value[k])
            for k in sorted(value.keys())
        )
        return "{" + items + "}"
    raise TypeError(f"unsupported type: {type(value)}")


def entry_hash(prev_hash, kind, payload):
    material = f"{prev_hash}|{kind}|{canonicalize(payload)}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def main(path):
    with open(path) as f:
        doc = json.load(f)
    entries = doc["entries"]
    prev = GENESIS
    ok = True
    for e in entries:
        recomputed = entry_hash(prev, e["kind"], e["payload"])
        link_ok = recomputed == e["hash"] and e["prev_hash"] == prev
        status = "ok" if link_ok else "BROKEN"
        print(f"#{e['seq']:02d} {e['kind']:24s} {e['hash'][:16]}… {status}")
        if not link_ok:
            ok = False
        prev = e["hash"]
    print(f"\n{len(entries)} entries — " + ("CHAIN INTACT" if ok else "CHAIN BROKEN"))
    return 0 if ok else 1


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__.strip().splitlines()[0])
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
