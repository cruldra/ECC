# Organizing Python Code

The Python form of the rules in [SKILL.md](../SKILL.md).

## Module Names

Module and package names are lowercase with underscores, as PEP 8 says: `order_matching.py`, never `OrderMatching.py`. An uppercase file name breaks renames in git between case-insensitive macOS and case-sensitive Linux.

## A File Before a Directory

A Python module already holds several classes and functions, so there is no need to start with a directory per class as in Java. Use a file while it is enough; turn it into a directory only when rule 5 of SKILL.md triggers.

## Layer File Names

The service layer is singular, `service`; every other layer is plural. This is the project's choice; keep it everywhere.

| File | Holds |
|---|---|
| `models.py` | ORM entities and enums |
| `schemas.py` | Request and response shapes (Pydantic) |
| `repositories.py` | Reading and writing data |
| `service.py` | Use cases and business logic |
| `routes.py` | HTTP endpoints for users |
| `tasks.py` | Background jobs (Celery and the like) |
| `exceptions.py` | Business exceptions |
| `deps.py` | Framework dependency injection (FastAPI `Depends`) |
| `console/` | The admin side, laid out inside with the same `routes`, `schemas`, `service` |

The synonyms the guard test rejects: `services`, `repository`, `errors`, `model`, `schema`, `route`, `router`, `routers`, `task`, `dependencies`.

## Turning a File Into a Directory

- **Change the imports to the new path.** Do not re-export the old names from `__init__.py`: one thing gets one import path.
- **Teach the model loader the directory first.** When ORM models load by scanning file names (for example every `*models.py`, so the metadata sees every table), make the loader find `models/` directories before turning `models.py` into one. Otherwise the models silently stop loading: foreign keys fail, and Alembic autogenerate may emit statements that drop the tables.
- **Circular imports after a split.** Imports needed only for type annotations go under `if TYPE_CHECKING:`. Two modules that need each other at run time mean the split drew the boundary in the wrong place; move the code, do not import inside functions to dodge it.

## Tests Mirror the Source

The test tree mirrors the source tree: `app/order/service/checkout.py` is tested in `tests/order/service/test_checkout.py`.

## Guard Test

Copy this into `tests/test_layout.py` and point `SOURCE` at the package root. Run it once with an empty `ALLOWED`, paste the lines it prints into `ALLOWED`, and commit. From then on, only delete lines from `ALLOWED`.

```python
"""Hold the source tree to the organizing-code layout; violations that already existed are allowlisted, and the list only shrinks."""

from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "app"
SHARED = {"core"}
SKIP = {"__pycache__", "migrations", "alembic"}
MAX_LINES = 800
LAYERS = {"models", "schemas", "repositories", "service", "routes", "tasks", "exceptions", "deps"}
SYNONYMS = {
    "services": "service",
    "repository": "repositories",
    "errors": "exceptions",
    "model": "models",
    "schema": "schemas",
    "route": "routes",
    "router": "routes",
    "routers": "routes",
    "task": "tasks",
    "dependencies": "deps",
}
VAGUE = {"utils", "util", "helpers", "helper", "common", "misc"}

# Each line is a violation that existed when this test was added. Only ever delete lines.
ALLOWED = [
]


def violations():
    """Every layout rule broken under `SOURCE`, as `"<rule>: <path from SOURCE>"`."""
    found = set()
    for path in SOURCE.rglob("*"):
        relative = path.relative_to(SOURCE)
        if SKIP.intersection(relative.parts) or (path.is_file() and path.suffix != ".py"):
            continue
        name = path.stem if path.is_file() else path.name
        if name == "__init__":
            continue
        where = relative.as_posix()
        if relative.parts[0] not in SHARED and (name in VAGUE or name.endswith(tuple(f"_{word}" for word in VAGUE))):
            found.add(f"says neither layer nor business: {where}")
        if name in SYNONYMS:
            found.add(f"use {SYNONYMS[name]}: {where}")
        if name.endswith(tuple(f"_{layer}" for layer in LAYERS | SYNONYMS.keys())):
            found.add(f"prefixed layer file, make it a subpackage: {where}")
        if path.is_file() and name == path.parent.name:
            found.add(f"named like its directory: {where}")
        if path.is_file() and len(path.read_text(encoding="utf-8").splitlines()) > MAX_LINES:
            found.add(f"over {MAX_LINES} lines: {where}")
    return found


def listing(entries):
    return "\n".join(f"    {entry!r}," for entry in sorted(entries))


def test_no_new_layout_violations():
    new = violations() - set(ALLOWED)
    assert not new, f"Move this code where organizing-code puts it:\n{listing(new)}"


def test_allowlist_only_shrinks():
    fixed = set(ALLOWED) - violations()
    assert not fixed, f"Already fixed; delete these lines from ALLOWED:\n{listing(fixed)}"
```

The test checks names and sizes only. Whether a file holds 3 use-case groups that do not call each other, and which way the calls run, is for review.
