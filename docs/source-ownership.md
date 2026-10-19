# Source ownership

Decision note for the web editor. Not implemented.

A source has one owner. The owner creates it and only the owner calls `Dispose`. A lower layer may use a source passed down to it and must not dispose it.

## Where a source is created

**Root.** Created when the document mounts and disposed when the document unmounts. Player health shared by several elements lives here. Opened with `UseSource`.

**A node in the hierarchy.** Created when that node mounts and disposed when that node unmounts. Health that belongs to one cell does not listen at the document root. Opened with `UseSource`; that node is the owner. Children may read the source and must not dispose it.

**Props.** The component does not create sources. It exposes `sources: Record<string, Source>`. The parent passes an already filled record. The component does not call `UseSource` or `Dispose`. A missing record is not filled in by the component.

Passing the same source further down does not change its owner. An intermediate node may forward it and still must not dispose it. Disposal stays at the place where the source was created.

## Editor

The root list, the sources a node owns, and props received from outside stay separate. A props row has no create or delete action. Moving a source from the root onto a node changes its owner. Moving it onto a child that only uses it does not.
