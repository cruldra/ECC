---
name: applying-design-patterns
description: 'Use when refactoring or reviewing code that keeps changing in the same place, or when someone asks which design pattern fits, whether a pattern is overkill, or to optimize code with design patterns (设计模式). Starts from the pain in the code, never from the pattern: a long if/switch on type or status, a constructor with many optional parameters, object creation scattered across callers, a subclass for every combination, an incompatible third-party interface, a source that hard-codes who to notify, one algorithm copied with small differences. Maps each signal to one of the 22 classic patterns described on refactoring.guru, prefers the language-native form (function, closure, generator, module) over a class hierarchy, rejects a pattern with only one variant, and refactors in small test-guarded steps. Pattern cards with signals, steps, costs and look-alikes live in references/creational.md, structural.md and behavioral.md.'
---

# Applying Design Patterns

A design pattern is a named shape for a design problem that keeps coming back. It earns its place only when it removes a cost the code pays today: every new variant edits the same big class, the same branch is copied into every caller, one subclass per combination. This skill finds that cost first, then picks the smallest pattern that removes it, or no pattern at all.

## When to Use

- Refactoring code where the same function or class is edited for every new variant, channel, status, or provider.
- Reviewing a change that adds another `elif`/`case` to a long branch, another optional constructor parameter, or another subclass for a combination.
- Someone asks "which pattern fits here", "is this overkill", or "optimize this with design patterns".
- Taking out a pattern that no longer pays for itself.

It does not decide where new files go or what they are called (see `organizing-code`), application-wide architecture (see `hexagonal-architecture`), or framework idioms (the `*-patterns` skills).

## How It Works

### 1. Name the Pain Before the Pattern

Before suggesting anything, write one sentence in this shape: "Every time we add or change X, we edit Y." X is the axis of change; Y is the code that suffers. Back it with the code or its history (`git log -p --follow <file>`): a branch that gained one case a month is a real axis, a branch written once three years ago is not. If you cannot write the sentence, stop. There is nothing for a pattern to fix.

### 2. Pass the Gate

Apply a pattern only when all four checks hold:

1. **Enough variants.** Three variants in the code, or two plus a third that is already scheduled. One implementation behind an interface is speculative generality.
2. **Variants change for different reasons.** If they always change together, keep them together.
3. **No language feature already does it.** See step 4.
4. **The next change gets smaller.** Count the files and functions you would touch to add the next variant, before and after. If the count does not drop, the pattern only moves code around.

When a check fails, the answer is usually a plain refactoring: extract a method, add guard clauses, use a lookup table, introduce a parameter object. Say so. "No pattern" is a valid result.

### 3. Map the Signal to a Pattern

| Signal in the code | First candidate | Check against |
| --- | --- | --- |
| An `if`/`switch` on a type or mode picks one of several algorithms | Strategy | State, if the branches also change the mode |
| The same status field is checked in many methods; transitions are scattered | State | Strategy, if nothing transitions |
| Callers construct a concrete class chosen by a condition | Factory Method | Abstract Factory, if several products must match |
| Objects from one family must not be mixed with another (theme, vendor, platform) | Abstract Factory | Factory Method, if there is only one product |
| A constructor takes many optional parameters, or assembly runs in steps | Builder | Named or default arguments |
| Subclasses differ only in initial values; configured objects get copied | Prototype | A factory with presets |
| The code needs exactly one shared instance | One instance injected from the composition root | Singleton, only when injection is impossible |
| A third-party or legacy interface does not fit the calling code | Adapter | Facade, when wrapping a whole subsystem |
| Class count multiplies across two dimensions (`Shape × Renderer`) | Bridge | Strategy, when one dimension is just an algorithm |
| A part-whole tree where leaves and groups are handled alike | Composite | Plain recursion over data |
| Optional behaviors stack around one interface (retry, cache, log); a subclass per combination | Decorator | Proxy, when one wrapper controls access |
| Callers repeat the same multi-step sequence against several subsystem classes | Facade | Mediator, when those classes talk to each other |
| Huge numbers of near-identical objects exhaust memory | Flyweight | Interning or a cache |
| Access needs lazy loading, caching, permission checks, or remoting behind the same interface | Proxy | Decorator, when behaviors stack |
| A request passes a series of checks or handlers, and any of them may stop it | Chain of Responsibility | A list of functions run in a loop |
| Operations must be queued, retried, logged, scheduled, or undone | Command | A closure, when undo and persistence are not needed |
| Traversal code is copied around or exposes the collection's internals | Iterator | The language's iteration protocol |
| Many components reference each other directly (form fields, widgets) | Mediator | Observer, when the flow is one-to-many |
| Undo or rollback needs a snapshot of private state | Memento | Command with inverse operations |
| A change must notify a varying set of dependents, and the source hard-codes them | Observer | Mediator, when the dependents also coordinate |
| Several classes run the same algorithm skeleton with a few different steps | Template Method | Strategy, to vary the steps by composition |
| Many unrelated operations run over a stable class hierarchy (AST, document) | Visitor | Pattern matching on a closed union type |

Read the pattern card before writing code. Each card lists the signals, the refactoring steps, the costs, and the look-alikes: [creational](references/creational.md), [structural](references/structural.md), [behavioral](references/behavioral.md).

### 4. Prefer the Language-Native Form

Many classic patterns spell out in classes what modern languages provide directly. Use the lightest form that keeps the same seam, and move to the class form only when its trigger appears:

| Pattern | Lighter form first | Move to the class form when |
| --- | --- | --- |
| Strategy | A function, or a map from key to function | A variant carries configuration or several related methods |
| Command | A closure | Undo, persistence, or a history is required |
| Iterator | A generator or the language's iterable protocol | Never, in languages that have one |
| Observer | The platform's event emitter, signals, or a list of callbacks | Subscribers need typed events and lifecycle control |
| Template Method | A higher-order function that takes the varying steps | Subclasses already exist and share state |
| Decorator | A function wrapper or middleware | The wrapped object exposes many methods |
| Builder | Keyword or default arguments, `dataclasses.replace`, object spread, Kotlin `copy` | Steps have ordering rules or validation across fields |
| Prototype | `copy.deepcopy`, `structuredClone`, `copy()` on data classes | Copies must not share owned resources |
| Singleton | A module-level instance, or one instance in a DI scope | Never, if injection is available |
| Factory Method | A factory function or a registry map | Subclasses must override creation |
| State | A transition table (state, action) to next state | Each state also changes how other methods behave |
| Visitor | Exhaustive `match`/`when`/`switch` over a closed union type | The language has no exhaustive matching |

### 5. Refactor in Small Steps

1. Pin the current behavior with tests on the public entry point. If none exist, write characterization tests first (`tdd-workflow`).
2. Introduce the seam (interface or function type) with the existing behavior as its only implementation. Tests stay green.
3. Move one variant at a time out of the branch into its own implementation. Run the tests after each move.
4. Delete the old branch and any temporary switch in the same change. Do not leave two paths.
5. Wire the variants in one place (composition root, factory, registry), not in every caller.

### 6. Know What Each Pattern Costs

- Facade and Mediator grow into god objects. Split one when it takes on a second responsibility.
- Singleton hides dependencies and breaks test isolation. Inject instead.
- Visitor makes every new element class edit every visitor. Use it only when the hierarchy is stable and the operations churn.
- Decorator stacks depend on order and are hard to debug. Build the stack in one place.
- Observer does not guarantee notification order. Subscribers must not depend on each other.
- Abstract Factory and Bridge add parallel hierarchies. Use them only for real families or dimensions.
- Template Method locks subclasses to one skeleton. A subclass that overrides a step to do nothing is a sign the inheritance is wrong.

### 7. Tell Look-Alikes Apart

Several patterns share one structure, delegating work to another object, and differ only in intent. Name the intent when you propose one:

- **Strategy, State, Bridge, Command.** Strategy swaps how one job is done, and the variants do not know each other. State variants know each other and switch the context between them. Bridge splits two independent dimensions so each can grow alone. Command turns a call into an object that can be stored, queued, or undone.
- **Adapter, Proxy, Decorator, Facade.** Adapter gives an object a different interface. Proxy keeps the same interface and controls access. Decorator keeps the same interface, adds behavior, and stacks. Facade puts one new, simpler interface over many objects.
- **Factory Method, Abstract Factory, Builder, Prototype.** Factory Method makes one product through an overridable method. Abstract Factory makes a matching family. Builder makes one complex product in steps. Prototype copies a configured instance.
- **Template Method and Strategy.** Template Method varies steps through inheritance, fixed per class. Strategy varies them through composition, switchable at runtime.
- **Facade and Mediator.** A facade is one-way: the subsystem does not know it exists. A mediator sits between peers that talk only through it.
- **Observer and Mediator.** Observer is a dynamic one-to-many subscription. Mediator centralizes many-to-many coordination.

### 8. Report the Proposal

For each place, report:

- **Pain**: the sentence from step 1, with `file:line`.
- **Pattern**: the name and the form, native or class.
- **Gate**: why each of the four checks passes.
- **Cost**: the new types or files, and which look-alike was rejected and why.
- **Steps**: the step 5 sequence applied to this code.
- **Next variant**: what adding the next one looks like afterwards, such as one new function and one registry line.

List places that fail the gate under **No pattern**, with the plain refactoring that fits instead.

## Examples

### Strategy as a Lookup Table (Python)

Pain: "Every new carrier edits `quote()`."

```python
def quote(order: Order, carrier: str) -> Decimal:
    if carrier == "ups":
        return Decimal("5") + order.weight * Decimal("1.2")
    elif carrier == "fedex":
        return Decimal("7") + order.weight
    elif carrier == "dhl":
        return max(Decimal("10"), order.weight * Decimal("1.5"))
    raise ValueError(f"unknown carrier: {carrier}")
```

Three carriers exist and a fourth is scheduled, so the gate passes. A function per carrier is enough; nothing needs a class yet:

```python
from collections.abc import Callable
from decimal import Decimal

Quote = Callable[[Order], Decimal]

def _ups(order: Order) -> Decimal:
    return Decimal("5") + order.weight * Decimal("1.2")

def _fedex(order: Order) -> Decimal:
    return Decimal("7") + order.weight

def _dhl(order: Order) -> Decimal:
    return max(Decimal("10"), order.weight * Decimal("1.5"))

CARRIERS: dict[str, Quote] = {"ups": _ups, "fedex": _fedex, "dhl": _dhl}

def quote(order: Order, carrier: str) -> Decimal:
    strategy = CARRIERS.get(carrier)
    if strategy is None:
        raise ValueError(f"unknown carrier: {carrier}")
    return strategy(order)
```

Next variant: one function and one dictionary entry; `quote()` stays untouched. Move to strategy classes when a carrier needs its own configuration, such as an API client or a rate table.

### State as a Transition Table (TypeScript)

Pain: "Every new order action repeats the status checks in `pay()`, `ship()`, and `cancel()`."

```typescript
type Status = "draft" | "paid" | "shipped" | "cancelled";
type Action = "pay" | "ship" | "cancel";

const transitions: Record<Status, Partial<Record<Action, Status>>> = {
  draft: { pay: "paid", cancel: "cancelled" },
  paid: { ship: "shipped", cancel: "cancelled" },
  shipped: {},
  cancelled: {},
};

class Order {
  status: Status = "draft";

  apply(action: Action): void {
    const next = transitions[this.status][action];
    if (!next) throw new Error(`cannot ${action} a ${this.status} order`);
    this.status = next;
  }
}
```

The table makes every allowed move visible in one place. Move to one class per state only when each status also changes how pricing, refunds, or notifications behave, so status checks would otherwise spread into those methods too.

### Rejected: A Factory With One Product

A `NotificationFactory` that only ever returns `EmailNotification` fails gate check 1. Inline the constructor call and delete the factory. Bring back a factory function when a second channel actually ships.

## Before You Finish

- [ ] Every proposed pattern has a pain sentence backed by the code or its history.
- [ ] Every proposal passes the four gate checks; the places that fail are listed under **No pattern**.
- [ ] The language-native form was considered before the class form.
- [ ] The look-alikes were compared and the chosen intent is named.
- [ ] The refactoring kept the tests green after each step and left no second path.

## Source

The intents, applicability, implementation steps, trade-offs, and relations behind the pattern cards are summarized in our own words from the design patterns catalog on [refactoring.guru](https://refactoringguru.cn/design-patterns) by Alexander Shvets.
