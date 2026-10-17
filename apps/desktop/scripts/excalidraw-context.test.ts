import assert from "node:assert/strict";
import { test } from "node:test";
import { drawingContext } from "../src/pages/notes/lib/excalidraw-context";
import { exportScale } from "../src/pages/notes/lib/excalidraw-image";

const scene = (elements: unknown[], files = {}) => JSON.stringify({ type: "excalidraw", version: 2, elements, files });

test("drawing context describes labels, positions, groups and arrow connections", () => {
  const context = drawingContext(
    scene([
      { id: "request", type: "rectangle", x: 10, y: 20, width: 120, height: 60, groupIds: ["flow"], frameId: "frame" },
      { id: "request-label", type: "text", containerId: "request", text: "Customer request" },
      { id: "decision", type: "diamond", x: 300, y: 20, width: 100, height: 80 },
      { id: "decision-label", type: "text", containerId: "decision", text: "Approve?" },
      {
        id: "edge",
        type: "arrow",
        x: 130,
        y: 50,
        points: [
          [0, 0],
          [170, 0],
        ],
        startBinding: { elementId: "request" },
        endBinding: { elementId: "decision" },
        startArrowhead: null,
        endArrowhead: "arrow",
      },
    ]),
  );
  const structure: { elements: Record<string, unknown>[] } = JSON.parse(context.split("\n\n").at(-1)!);
  assert.deepEqual(structure.elements[0], {
    id: "request",
    type: "rectangle",
    frameId: "frame",
    x: 10,
    y: 20,
    width: 120,
    height: 60,
    label: "Customer request",
    groupIds: ["flow"],
  });
  assert.deepEqual(structure.elements[4].start, { arrowhead: null, elementId: "request", label: "Customer request" });
  assert.deepEqual(structure.elements[4].end, { arrowhead: "arrow", elementId: "decision", label: "Approve?" });
  assert.match(context, /x increases rightward and y downward/);
});

test("drawing context excludes deleted elements, embedded files and freehand point payloads", () => {
  const context = drawingContext(
    scene(
      [
        { id: "removed", type: "text", text: "Deleted secret", isDeleted: true },
        { id: "picture", type: "image", fileId: "file", x: 0, y: 0, width: 100, height: 100 },
        {
          id: "ink",
          type: "freedraw",
          x: 10,
          y: 10,
          width: 90,
          height: 50,
          points: Array.from({ length: 10_000 }, () => [77, 88]),
          customData: { secret: "Private metadata" },
        },
      ],
      { file: { mimeType: "image/png", dataURL: "data:image/png;base64,EmbeddedSecret" } },
    ),
  );
  assert.match(context, /Visible elements: 2/);
  assert.match(context, /"mimeType":"image\/png"/);
  assert.doesNotMatch(context, /Deleted secret|EmbeddedSecret|dataURL|Private metadata|77/);
  assert.ok(context.length < 2000);
  assert.match(context, /not interpreted/);
});

test("unbound connectors do not invent relationships", () => {
  const context = drawingContext(
    scene([
      {
        id: "edge",
        type: "line",
        points: [
          [0, 0],
          [50, 30],
        ],
      },
    ]),
  );
  const structure: { elements: Record<string, unknown>[] } = JSON.parse(context.split("\n\n").at(-1)!);
  assert.deepEqual(structure.elements[0].start, { arrowhead: null });
  assert.deepEqual(structure.elements[0].end, { arrowhead: null });
});

test("empty drawings are readable and malformed scenes are rejected", () => {
  assert.match(drawingContext(scene([])), /Visible elements: 0/);
  for (const body of ["Markdown", "{}", JSON.stringify({ type: "excalidraw", version: 1, elements: [] })])
    assert.throws(() => drawingContext(body));
});

test("drawing context says where freehand and pictures are when an image goes with it", () => {
  assert.match(drawingContext(scene([])), /freehand strokes are not interpreted/);
  assert.match(drawingContext(scene([]), { withImage: true }), /appear in the attached image/);
});

test("drawing images stay within size limits and enlarge small sketches", () => {
  assert.equal(exportScale(1000, 500), 1);
  assert.equal(exportScale(200, 100), 2);
  assert.equal(exportScale(500, 100), 768 / 500);
  assert.equal(exportScale(6000, 1000), 1536 / 6000);
  const square = exportScale(3000, 3000);
  assert.ok(3000 * square * 3000 * square <= 1_600_000);
  assert.equal(exportScale(1000, 500, 0.7), 0.7);
  assert.ok(Number.isFinite(exportScale(0, 0)));
});
