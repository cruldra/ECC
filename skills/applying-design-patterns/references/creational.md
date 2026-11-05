# Creational Patterns

Part of [SKILL.md](../SKILL.md). Creational patterns control how objects get made, so callers stop depending on concrete classes. Run the gate in SKILL.md before using any card.

## Factory Method

- **Intent**: Let one method decide which concrete class to create, so callers depend on a product interface instead of a constructor.
- **Signals**: The same "if kind is A, build X; if B, build Y" logic appears in several callers. A library or framework must let users replace a built-in component with their own subclass. Creation sometimes has to return a pooled or cached instance, which a constructor cannot do.
- **Steps**:
  1. Give every product one interface that holds the operations callers actually use.
  2. Add a creation method that returns that interface, and move every direct constructor call into it.
  3. When subclasses must customize creation, override the method in each subclass; otherwise keep one function with a parameter or a registry.
  4. Make the base method abstract only once no default product is left in it.
- **Costs**: With inheritance, one creator subclass per product. Cheapest when a creator hierarchy already exists.
- **Look-alikes**: Abstract Factory makes a matching family, not one product. Prototype copies instead of constructing. Factory Method is Template Method where the varying step is "create".
- **Native form**: A factory function, or a map from key to constructor.

## Abstract Factory

- **Intent**: Create families of related objects that must be used together, without naming their concrete classes.
- **Signals**: Code chooses variants by environment or configuration in many places (`if theme == "dark"`), and mixing a dark button with a light dialog is a bug. One class holds creation methods for many different product types.
- **Steps**:
  1. Draw a matrix of product types against variants.
  2. Declare one interface per product type.
  3. Declare a factory interface with one creation method per product type.
  4. Write one concrete factory per variant.
  5. Pick the factory once at startup from configuration, and pass it to everyone who creates products.
  6. Replace direct constructor calls with calls on the factory.
- **Costs**: Many interfaces and classes. Adding a new product type changes every factory.
- **Look-alikes**: Builder returns one product after several steps; Abstract Factory returns finished products at once. Facade hides how a subsystem is used; Abstract Factory hides only how its objects are created.
- **Native form**: One module or object per variant that exposes the same creation functions.

## Builder

- **Intent**: Construct a complex object step by step, reusing the same construction code for different representations.
- **Signals**: Telescoping constructors, or a constructor with ten optional parameters. The same assembly sequence must produce different outputs, such as SQL for two dialects or a report as HTML and PDF. A tree has to be built recursively. A half-built object must never reach a caller.
- **Steps**:
  1. List the construction steps common to every representation. If no common list exists, stop: the pattern does not fit.
  2. Declare those steps on a builder interface.
  3. Write one concrete builder per representation, each with its own method that returns the result.
  4. Optionally add a director that owns the standard step sequences.
  5. Callers take the product from the builder, or from the director when all products share an interface.
- **Costs**: Extra classes. The result method cannot live on the shared interface when products have no common type.
- **Look-alikes**: Abstract Factory makes families immediately. Builder is a good way to assemble a Composite tree.
- **Native form**: Keyword or named arguments with defaults, data classes with `replace` or `copy`, object spread. Write a fluent builder only when steps have ordering rules or validation across fields.

## Prototype

- **Intent**: Copy existing objects without depending on their concrete classes.
- **Signals**: Objects arrive through an interface and need copying. Subclasses exist only to start with different configuration. Expensive setup runs again for every new instance.
- **Steps**:
  1. Add a `clone` method to the shared interface.
  2. In each class, implement `clone` by copying every field; let the parent class copy the fields it owns.
  3. Optionally keep a registry of preconfigured prototypes looked up by key, which returns clones.
  4. Replace constructor calls on those subclasses with registry lookups.
- **Costs**: Objects with cycles, or ones that own connections or file handles, are hard to copy correctly. Decide deep or shallow copy explicitly for every field.
- **Look-alikes**: Factory Method builds through inheritance without copying. Prototype can stand in for Memento when the state is simple and links to nothing outside.
- **Native form**: `copy.deepcopy`, `structuredClone`, `dataclasses.replace`, Kotlin `copy()`.

## Singleton

- **Intent**: Guarantee that a class has one instance, and give everyone a global way to reach it.
- **Signals**: A resource that must exist exactly once per process, such as configuration loaded once or a connection pool, where a second instance would be a bug.
- **Steps**:
  1. First try to create one instance at the composition root and inject it. Stop here if that works.
  2. Otherwise add a private static field for the instance and a public static accessor that creates it on first use.
  3. Make the constructor private, and replace every constructor call with the accessor.
  4. In concurrent runtimes, make first-use creation thread-safe.
- **Costs**: It solves two problems at once, one instance and global access, so it breaks single responsibility. It hides who depends on it, makes tests share state, and is hard to replace with a fake.
- **Look-alikes**: Flyweight shares many immutable instances; Singleton has one, possibly mutable. A Facade often needs only one instance, but that does not make it a Singleton.
- **Native form**: A module-level instance (a Python or ES module is loaded once per process), or a single-instance scope in a DI container.
