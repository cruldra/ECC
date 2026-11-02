# Behavioral Patterns

Part of [SKILL.md](../SKILL.md). Behavioral patterns decide how objects communicate and who is responsible for what. Run the gate in SKILL.md before using any card.

## Chain of Responsibility

- **Intent**: Pass a request along a chain of handlers, where each handler either handles it or passes it to the next.
- **Signals**: A request runs through a series of checks such as authentication, validation, rate limiting, and caching, written as one long function with early returns. Which handlers run, and in what order, depends on configuration or must change at runtime.
- **Steps**:
  1. Declare a handler interface with one method that takes the request.
  2. Turn the request data into one object, so the method signature stays stable.
  3. Optionally write a base handler that stores the next handler and passes the request on by default.
  4. Write one concrete handler per check. Each decides whether to handle the request and whether to pass it along.
  5. Build the chain in one place, from configuration if it varies.
  6. Make clients ready for a chain of one, a request that stops early, and a request that nobody handles.
- **Costs**: A request can fall off the end of the chain unhandled. Debugging means following the chain.
- **Look-alikes**: Decorator layers always pass the request on; chain handlers may stop it. Command can be used to represent the requests. Composite trees often pass requests up to the parent as a chain.
- **Native form**: A list of handler functions run in a loop, or the framework's middleware pipeline.

## Command

- **Intent**: Turn a request into a standalone object that holds everything needed to run it, so it can be passed around, queued, scheduled, logged, or undone.
- **Signals**: UI actions, jobs, or operations must be queued, retried, run later, sent to another process, recorded, or undone. The same operation is triggered from several places (button, shortcut, menu) and the trigger code duplicates it.
- **Steps**:
  1. Declare a command interface with one execute method.
  2. Extract each request into a concrete command class whose fields hold the parameters and a reference to the receiver that does the work. Set them all in the constructor.
  3. Give senders a field for a command, and let them talk to it only through the interface.
  4. Change senders to execute their command instead of calling the receiver.
  5. Wire it in this order: create the receiver, create the command with the receiver, attach the command to the sender.
  6. For undo, keep a history of executed commands with either a state backup (see Memento) or an inverse operation.
- **Costs**: A new layer between senders and receivers.
- **Look-alikes**: Strategy describes different ways to do one thing; Command turns any operation into an object. Memento pairs with Command for undo. Chain of Responsibility can pass commands along.
- **Native form**: A closure, when undo, persistence, and history are not needed.

## Iterator

- **Intent**: Traverse the elements of a collection without exposing how it is stored, whether list, stack, tree, or paged API.
- **Signals**: Traversal code for a tree, graph, or paginated source is copied into several callers. Callers reach into the collection's internals to walk it. Code must walk collections whose type it cannot know in advance.
- **Steps**:
  1. Declare an iterator interface with at least a way to get the next element.
  2. Declare a collection interface with a method that returns an iterator.
  3. Write a concrete iterator per traversal, linked to one collection instance through its constructor.
  4. Implement the collection interface on the collection classes.
  5. Replace the traversal code in callers with iterators.
- **Costs**: Overkill for simple collections. For some special collections, an iterator is slower than direct access.
- **Look-alikes**: Composite trees are traversed with iterators. Memento can snapshot an iterator's position. Visitor can run over the elements an iterator yields.
- **Native form**: Generators and the language's iterable protocol (`__iter__`, `Symbol.iterator`, Go range-over-func). Hand-written iterator classes are rarely needed.

## Mediator

- **Intent**: Reduce tangled dependencies between objects by making them talk through one mediator instead of to each other.
- **Signals**: Components in a form, dialog, or workflow hold references to each other and call each other directly, so changing one breaks others. A component cannot be reused elsewhere because it knows its neighbors. Subclasses exist only to change how components cooperate.
- **Steps**:
  1. Find a group of tightly coupled classes that would gain from being independent.
  2. Declare a mediator interface; usually one method that receives notifications from components is enough.
  3. Write a concrete mediator that holds references to all its components.
  4. Give each component a reference to the mediator, set in the constructor.
  5. Replace each direct call to another component with a notification to the mediator, and move the reaction code into the mediator.
- **Costs**: The mediator can grow into a god object.
- **Look-alikes**: Facade is one-way and the subsystem does not know it; mediator components do. Observer offers dynamic one-to-many subscriptions; a mediator is often built on top of Observer but centralizes the coordination. Chain of Responsibility, Command, Mediator, and Observer all connect senders and receivers in different ways.
- **Native form**: An event bus scoped to the group of components.

## Memento

- **Intent**: Save and restore an object's earlier state without exposing its internals.
- **Signals**: You need undo, or a rollback when a multi-step operation fails, and taking the snapshot would otherwise require public getters for private fields.
- **Steps**:
  1. Decide which class is the originator whose state gets saved.
  2. Write an immutable memento class with fields that mirror the originator's state, set once in the constructor.
  3. Nest the memento in the originator if the language allows; otherwise expose it to others only through an empty or metadata-only interface.
  4. Add a method on the originator that creates a memento from its state, and one that restores state from a memento.
  5. Let a caretaker, such as a command or a history object, decide when to take snapshots, where to store them, and when to restore.
- **Costs**: Frequent snapshots use a lot of memory. The caretaker must track the originator's lifecycle to discard old snapshots. Dynamic languages cannot fully stop others from reading or changing a memento.
- **Look-alikes**: Command implements undo with inverse operations instead of snapshots. Prototype can replace Memento when the state is simple and has no external links. Iterator positions can be saved as mementos.
- **Native form**: An immutable copy of a data class, or a stored serialized snapshot.

## Observer

- **Intent**: Let objects subscribe to events on another object and get notified when they happen.
- **Signals**: A change in one object must trigger work in others, and the set of those others varies or is not known when the source is written. The source currently calls each dependent directly, so every new dependent edits the source.
- **Steps**:
  1. Split the logic into a core publisher that is independent of the rest, and subscribers that react to it.
  2. Declare a subscriber interface with at least an update method.
  3. Give the publisher methods to add and remove subscribers, and let it talk to them only through the interface.
  4. Keep the subscription list in a reusable base class or a separate helper object.
  5. Notify all subscribers whenever a significant event happens, passing the event data, or the publisher itself, as an argument.
  6. Let the client create subscribers and register them with publishers.
- **Costs**: Subscribers are notified in no guaranteed order. Forgotten subscriptions leak memory. The flow of control becomes harder to follow.
- **Look-alikes**: Mediator centralizes coordination between many peers; Observer is a dynamic one-to-many link. Chain of Responsibility passes a request until one handler takes it; Observer delivers it to every subscriber.
- **Native form**: The platform's event emitter, signals, or a list of callbacks.

## State

- **Intent**: Let an object change its behavior when its internal state changes, as if it switched to another class.
- **Signals**: The same status field is checked with `if`/`switch` in many methods. State transitions are scattered across the class. Similar states repeat the same branches with small differences. New states are added often.
- **Steps**:
  1. Pick the context class: the existing class with state-dependent code, or a new one if that code is spread over several classes.
  2. Declare a state interface with only the methods whose behavior depends on the state.
  3. Write one class per state, and move the state-specific code from the context into it.
  4. If that code needs private context members, make them public, expose public context methods, or nest the state classes.
  5. Give the context a field of the state interface type and a method to replace it.
  6. Replace the conditionals in the context with calls on the current state object.
  7. Decide who switches states, the context or the states themselves, and keep that rule consistent.
- **Costs**: Overkill when there are few states or they rarely change.
- **Look-alikes**: Strategy has the same shape, but strategies are independent and never replace each other; states know each other and trigger transitions. Bridge and Adapter share the same delegation structure with different intents.
- **Native form**: A transition table from state and action to the next state, until each state also changes the behavior of several methods.

## Strategy

- **Intent**: Define a family of interchangeable algorithms, each in its own unit, and let the caller choose one at runtime.
- **Signals**: An `if`/`switch` chooses between variants of the same algorithm, such as pricing rules, routing, export formats, or ranking. Several classes differ only in how they perform one behavior. An algorithm's details clutter a class whose main job is something else.
- **Steps**:
  1. Find the algorithm that changes often, or the conditional that selects its variant.
  2. Declare a strategy interface shared by all variants.
  3. Move each variant into its own implementation of that interface.
  4. Give the context a field for the strategy and a way to set it. The context talks to the strategy only through the interface.
  5. Let the client pick the strategy and pass it to the context.
- **Costs**: If the algorithms rarely change, the new classes are pure overhead. Clients must understand the differences between strategies to pick one.
- **Look-alikes**: State variants know each other and switch; strategies do not. Template Method varies steps through inheritance at class level; Strategy uses composition and switches at runtime. Command turns any operation into an object; Strategy varies how one task is done. Decorator changes an object's skin; Strategy changes its guts.
- **Native form**: A function, or a map from key to function. Move to classes when a variant carries configuration or several related methods.

## Template Method

- **Intent**: Define the skeleton of an algorithm in a base class and let subclasses override specific steps without changing its structure.
- **Signals**: Several classes contain nearly the same algorithm with small differences, such as importers for different file formats, so any change to the shared flow edits every class.
- **Steps**:
  1. Split the algorithm into steps, and decide which are common to all classes and which vary.
  2. Write a base class with the template method that calls the steps in order. Make the template method final if the language allows.
  3. Declare the varying steps as abstract, and give common or optional steps a default implementation.
  4. Add hooks, empty optional steps, at the points where subclasses may want to extend the algorithm.
  5. Write one subclass per variant that implements the abstract steps and overrides optional ones as needed.
- **Costs**: Subclasses are locked into the skeleton. A subclass that suppresses a default step can violate the Liskov substitution principle. The more steps, the harder it is to maintain.
- **Look-alikes**: Factory Method is a Template Method whose varying step is object creation. Strategy varies steps by composition at runtime, Template Method by inheritance at class level.
- **Native form**: A higher-order function that takes the varying steps as function arguments.

## Visitor

- **Intent**: Separate operations from the object structure they run on, so new operations need no changes to those classes.
- **Signals**: Many unrelated operations, such as export, validation, pricing, or pretty-printing, run over a stable class hierarchy such as an AST or a document model, and each operation is currently a method spread across every class. An operation makes sense for only some classes in the hierarchy.
- **Steps**:
  1. Declare a visitor interface with one visit method per concrete element class.
  2. Add an accept method that takes a visitor to the element interface.
  3. In each concrete element, implement accept by calling the visit method for its own class.
  4. Write one concrete visitor per operation.
  5. If visitors need private element data, either make it public or nest the visitor in the element class.
  6. Let clients create visitors and pass them to elements through accept.
- **Costs**: Every new element class changes every visitor. Visitors may lack access to private element members.
- **Look-alikes**: Visitor is a more powerful Command that runs on many object types. It often walks a Composite tree, together with Iterator.
- **Native form**: Exhaustive `match`, `when`, or `switch` over a closed union type, such as sealed classes or discriminated unions, where the compiler checks every case.
