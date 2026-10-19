---
name: organizing-code
description: 'Use when deciding where code goes and what files and directories are called: adding a module or package, splitting a large file, naming a file, carving out a subdomain, or restructuring directories. Lays code out by business first, then by layer, then by use case; every file name says its layer or its business, never neither (no utils, helpers, common, misc); one name per concept; a layer file becomes a directory of use-case files past 800 lines or at 3 use-case groups that do not call each other; a concept with its own tables and interface becomes a subpackage instead of a name prefix; calls run interface, service, repositories, models and never back. Answers the DDD questions that come up (file-name case, business names for entities, layer-first versus business-first, anemic models) and rolls the layout out with a guard test whose allowlist only shrinks. Language rules live in references/<language>.md; Python is in references/python.md.'
---

# Organizing Code

Decide where a piece of code goes by answering three questions in order: which business is it, which layer, which use case. The directory and file names follow from the answers.

## When to Use

- Adding a module, file, or package, or naming one.
- A file has grown too large, or a directory mixes several businesses.
- Restructuring directories, or reviewing a change that adds or moves files.
- Someone asks whether a layout is "DDD", or which of two names to keep.

It does not cover style inside a file, or names of functions and variables.

## Language Rules

Read the reference for the language at hand before applying the rules: [Python](references/python.md). It fixes the layer file names, the case convention, the language-specific pitfalls of a split, and the guard test. Each further language gets its own `references/<language>.md`. A language without one follows the rules below with its own naming conventions.

When another skill's sample layout groups a whole project by layer (top-level `routers/`, `services/`, `utils/`), this skill decides where files go.

## How It Works

### 1. Business, Then Layer, Then Use Case

The top-level directory is a business noun, one bounded context: `order/`, `catalog/`. Inside it, each layer is one file with a fixed name (`models`, `repositories`, `service`, `routes`, and so on; the language reference lists them). When a layer file grows too big, it becomes a directory of the same name, and the files inside are named by use case.

Do not group the whole project by layer (top-level `controllers/`, `services/`, `models/`). One change to orders would then touch every top-level directory, and nothing shows where one business ends.

### 2. A File Name Says Its Layer or Its Business

Every file name says one of two things: which layer it is (`repositories`), or which business or use case it handles (`checkout`). Names that say neither are banned: `utils`, `helpers`, `common`, `misc`, `service_helpers`. The one exception is the project-wide infrastructure directory, such as `core/` for the database session, settings, and logging.

A helper goes into the layer file of the business that uses it. Used by two businesses, it goes to the business that owns the concept, or into `core/` when it is infrastructure.

### 3. One Name per Concept

Keep one of each pair across the project: `service` or `services`, `repository` or `repositories`, `errors` or `exceptions`. The language reference fixes the choice.

### 4. Only Files That Are Used

Create a layer file when its first code arrives. Never create empty placeholder files for layers a business may need later.

### 5. A File Becomes a Directory Past 800 Lines or at 3 Use-Case Groups

A layer file becomes a directory of the same name when it passes 800 lines, or when it holds 3 or more groups of use cases that do not call each other. The files inside are named by use case: `service/checkout.py`, `service/refunding.py`. No file inside repeats the directory's name: never `service/service.py`.

### 6. A Subdomain With Its Own Tables and Interface Becomes a Subpackage

When a business concept has its own tables and its own interface (endpoints, an admin page), it becomes a subpackage, laid out by the same rules inside. Never tell subdomains apart with a name prefix: `routing_models.py` and `routing_repositories.py` become `routing/models.py` and `routing/repositories.py`.

### 7. Calls Run One Way

Interface (user routes, the admin console, scheduled tasks) → service → repositories → models. Nothing calls back up: a repository never calls a service, and a model never calls a repository.

## DDD Questions

- **File-name case is not DDD.** `snake_case` or `PascalCase` follows the language convention. DDD cares whether names use the business's language and whether the boundaries are drawn right.
- **An entity is named after one of what it holds, in the business's words.** A row that is one case is a `Case`, not a `CaseLibrary`: the library is the collection, and holding the collection is the repository's job.
- **Business first, then layer.** Grouping the whole project by layer (top-level `controller/`, `service/`) is not recommended. DDD's domain, application, and infrastructure are layers too, and they sit inside a business, not at the top.
- **Data-only entities are fine.** Entities that hold only data, with all logic in the service, are the anemic model. Strict DDD discourages it, but in Python with SQLAlchemy and similar stacks it is the norm and good enough; do not rewrite code for it. When there is a clear business rule, such as "only a READY case can be forked", prefer a method on the entity.

## Rolling Out: A Guard Test, Not a Big-Bang Refactor

Do not restructure a whole codebase in one go. Add a test that scans the source tree and reports:

- banned names (rule 2),
- synonyms of the chosen layer names (rule 3),
- files over 800 lines (rule 5),
- a file named like its directory, `x/x.py` (rule 5),
- layer files with a prefix, such as `routing_models` (rule 6).

The violations already there go into an allowlist that only shrinks. A new violation fails the test. An allowlisted entry that has been fixed fails it too, with a message to delete that line, so the fix cannot slide back. Then migrate one subsystem per ticket. The language reference has the test to copy.

## Examples

An order business laid out by layer across the project (Python names):

```text
app/
  services/
    order_service.py        # 1,400 lines: checkout, refunds, invoices
    order_helpers.py
  models/
    order.py
    shipping_models.py
  utils.py
```

The same code by business, then layer, then use case:

```text
app/
  core/
    db.py
  order/
    models.py
    repositories.py
    service/
      checkout.py
      refunding.py
      invoicing.py
    routes.py
    exceptions.py
    shipping/               # its own tables and endpoints
      models.py
      repositories.py
      service.py
      routes.py
```

- `services/` became one `service` per business, and `order_service.py` split by use case once it held three groups that do not call each other.
- `order_helpers.py` and `utils.py` said neither layer nor business; their functions moved into the layer files that use them, and the database setup into `core/`.
- `shipping_models.py` told a subdomain apart with a prefix; shipping has its own tables and endpoints, so it became `order/shipping/`.

## Before You Finish

For every file or directory added, renamed, or split in this change:

1. Its path reads business, then layer, then use case.
2. Its name says its layer or its business, and uses the one name chosen for that concept.
3. It has code in it; no placeholder files.
4. A layer file over 800 lines or with 3 independent use-case groups is now a directory, and nothing in it repeats the directory's name.
5. Imports run interface → service → repositories → models, never back.
6. The guard test passes, and any allowlist entry this change fixed is deleted.
