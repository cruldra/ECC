# Structural Patterns

Part of [SKILL.md](../SKILL.md). Structural patterns assemble objects and classes into larger structures while keeping each part replaceable. Run the gate in SKILL.md before using any card.

## Adapter

- **Intent**: Let objects with incompatible interfaces work together by putting a translator between them.
- **Signals**: A third-party SDK, legacy class, or class you cannot change has the wrong method names, argument shapes, or data formats for your code. Several callers convert to and from that format themselves.
- **Steps**:
  1. Confirm there is a service class you cannot or should not change, and at least one client that needs it.
  2. Declare a client interface in the caller's terms.
  3. Write an adapter that implements the client interface and holds a reference to the service.
  4. Implement each method by translating the call and its data, then delegating to the service. Put no business logic in the adapter.
  5. Make clients depend only on the client interface.
- **Costs**: An extra interface and class. When you own the service and it has few callers, changing it directly is simpler.
- **Look-alikes**: Decorator keeps the interface and adds behavior; Proxy keeps the interface and controls access; Facade defines a new interface for a whole subsystem, while Adapter usually wraps one object. Bridge is designed up front; Adapter retrofits existing code.
- **Native form**: A single translation function, when the client needs only one operation.

## Bridge

- **Intent**: Split a large class, or a set of closely related classes, into two hierarchies, abstraction and implementation, that can grow independently.
- **Signals**: Subclass names combine two dimensions (`CircleSvg`, `CircleCanvas`, `SquareSvg`), so adding one option on either side multiplies classes. One class talks to several back ends, such as databases, renderers, or payment gateways, with branches for each.
- **Steps**:
  1. Name the independent dimensions, such as abstraction and platform, domain and infrastructure, or front end and back end.
  2. Put what clients need in an abstraction class.
  3. Declare an implementation interface with the primitive operations the abstraction needs from every platform.
  4. Write one implementation class per platform.
  5. Give the abstraction a field that references an implementation, and delegate the platform work to it.
  6. Subclass the abstraction only for real variants of the high-level logic.
  7. Clients pass an implementation into the abstraction's constructor and then talk only to the abstraction.
- **Costs**: Applied to a class that is already cohesive, it only adds indirection.
- **Look-alikes**: Strategy has the same shape but swaps one algorithm; Bridge separates two whole dimensions. Abstract Factory can create matching abstraction and implementation pairs. Builder pairs with Bridge: the director is the abstraction and the builders are the implementations.
- **Native form**: Pass the implementation as an injected dependency with an interface; no abstraction hierarchy until a second high-level variant appears.

## Composite

- **Intent**: Compose objects into a tree, and treat a single object and a group of objects the same way.
- **Signals**: The model is genuinely part-whole: files and folders, menu items and submenus, order lines and bundles. Client code keeps asking "is this a leaf or a group?" before every operation.
- **Steps**:
  1. Check that the model can be represented as a tree of simple elements and containers, where containers can hold both.
  2. Declare a component interface with operations that make sense for both leaves and containers.
  3. Write leaf classes for the simple elements.
  4. Write a container class that holds a list of components and implements each operation by delegating to its children and combining the results.
  5. Add child management methods to the container. Putting them on the component interface lets clients treat everything alike, but leaves then carry empty methods.
- **Costs**: When leaves and containers do very different things, the shared interface becomes too general to understand.
- **Look-alikes**: Decorator also wraps components recursively, but has exactly one child and adds behavior. Builder can assemble Composite trees. Iterator and Visitor are common companions for traversal and operations.
- **Native form**: A recursive function over plain nested data, when the tree has no behavior of its own.

## Decorator

- **Intent**: Add behavior to an object at runtime by wrapping it in objects that share its interface.
- **Signals**: Optional behaviors such as retry, caching, logging, compression, or encryption are added around the same calls in many combinations. Subclasses exist for each combination (`LoggingRetryingClient`). The class to extend is final or third-party.
- **Steps**:
  1. Check that the behavior is a core component plus optional layers.
  2. Declare a component interface with the methods both share.
  3. Write the concrete component with the base behavior.
  4. Write a base decorator that holds a component reference and delegates every method to it.
  5. Write concrete decorators that do their work before or after delegating.
  6. Assemble the stack in one place, such as the composition root.
- **Costs**: Removing a specific layer from a stack is awkward. Behavior can depend on stack order. Assembly code gets noisy.
- **Look-alikes**: Adapter changes the interface; Proxy controls access and usually manages the wrapped object's lifecycle itself; Composite has many children, Decorator one. Chain of Responsibility handlers may stop the request; decorators always pass it on.
- **Native form**: Function wrappers, Python decorators, HTTP or RPC middleware.

## Facade

- **Intent**: Give a library, framework, or complex subsystem one simple interface for the common cases.
- **Signals**: Callers repeat the same initialization and the same sequence of calls across several subsystem classes. Upgrading the subsystem breaks many callers at once. You want each layer of a system to be entered through one door.
- **Steps**:
  1. Check that a simpler interface over the subsystem would let callers forget most of its classes.
  2. Declare and implement that interface in a facade class that forwards calls to the right subsystem objects and owns their setup and lifecycle.
  3. Route every caller through the facade, so a subsystem change touches only the facade.
  4. When the facade grows too broad, extract a second, narrower facade.
- **Costs**: A facade can become a god object coupled to every class in the program.
- **Look-alikes**: Adapter makes an existing interface usable; Facade defines a new one. Mediator coordinates peers that know it; the subsystem behind a facade does not know the facade exists. Abstract Factory can replace a facade when all you hide is object creation.
- **Native form**: A module that exposes a few functions over the subsystem.

## Flyweight

- **Intent**: Fit more objects into memory by sharing the state they have in common instead of storing it in every object.
- **Signals**: The program must create a very large number of similar objects, such as particles, glyphs, or map tiles, memory is actually running out, and much of each object's data repeats.
- **Steps**:
  1. Split the fields into intrinsic state, which is constant and shared, and extrinsic state, which differs per use.
  2. Keep the intrinsic fields in the flyweight class and make them immutable, set only in the constructor.
  3. Change methods that use extrinsic fields to take them as parameters instead.
  4. Optionally add a factory that returns an existing flyweight for the same intrinsic state, and make clients create flyweights only through it.
  5. Clients store or compute the extrinsic state, optionally in a separate context object.
- **Costs**: Trades CPU for memory, since context is passed or recomputed on every call. The split state confuses newcomers. Measure memory before and after; without a measured problem, do not apply it.
- **Look-alikes**: Singleton has one mutable instance; flyweights are many and immutable. Composite leaves are often good flyweight candidates.
- **Native form**: String or value interning, or a cache keyed by the intrinsic state.

## Proxy

- **Intent**: Put a stand-in in front of an object that controls access to it and can act before or after forwarding each request.
- **Signals**: A heavy object should be created only when first used (virtual proxy). Only some callers may use a service (protection proxy). A remote service should look local (remote proxy). Calls should be logged (logging proxy) or results cached (caching proxy). A heavy object should be released when no client uses it (smart reference).
- **Steps**:
  1. If the service has no interface, extract one; if that is impossible, make the proxy a subclass of the service.
  2. Write a proxy with a field for the service. The proxy usually creates the service and manages its lifecycle.
  3. Implement each method by doing the proxy's work and then delegating to the service.
  4. Optionally add a creation method that decides whether callers get the proxy or the real service.
  5. Consider lazy initialization of the service.
- **Costs**: More classes, and an added delay on responses.
- **Look-alikes**: Decorator has the same structure, but the client composes decorators, while a proxy usually controls its service itself. Adapter changes the interface; Proxy keeps it. Facade also buffers a complex object and initializes it, but Proxy keeps the same interface as its service.
- **Native form**: A caching or lazy-loading wrapper function, or the language's lazy value (`functools.cached_property`, Kotlin `by lazy`).
