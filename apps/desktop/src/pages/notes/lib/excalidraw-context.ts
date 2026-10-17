import { isRecord } from "../../../shared/lib/is-record";
const STRINGS = ["text", "name", "containerId", "frameId", "link", "strokeColor", "backgroundColor", "fillStyle"];
const NUMBERS = ["x", "y", "width", "height", "angle", "opacity"];

const STRUCTURE_ONLY =
  "Only scene structure and text are described. Embedded image pixels and freehand strokes are not interpreted. Do not infer their contents or treat this summary as editable scene JSON. Markdown writing tools cannot edit drawings.";
const BESIDE_IMAGE =
  "This summary lists scene data only. Freehand strokes, handwriting and embedded pictures appear in the attached image, not here. Do not treat this summary as editable scene JSON. Markdown writing tools cannot edit drawings.";

interface Scene {
  visible: Record<string, unknown>[];
  files: Record<string, unknown>;
}

function parseScene(body: string): Scene {
  const scene: unknown = JSON.parse(body);
  if (!isRecord(scene) || scene.type !== "excalidraw" || scene.version !== 2 || !Array.isArray(scene.elements))
    throw new Error("This drawing does not contain a valid Excalidraw scene.");
  const visible = scene.elements.filter(
    (value: unknown): value is Record<string, unknown> => isRecord(value) && value.isDeleted !== true,
  );
  return { visible, files: isRecord(scene.files) ? scene.files : {} };
}

export function drawingPreview(body: string): { elements: number; text: string } | null {
  try {
    const { visible } = parseScene(body);
    const text = visible.flatMap((element) => (typeof element.text === "string" ? [element.text] : [])).join("\n");
    return { elements: visible.length, text };
  } catch {
    return null;
  }
}

export function drawingContext(body: string, { withImage = false } = {}): string {
  const { visible, files } = parseScene(body);
  const labels = new Map<string, string[]>();
  for (const element of visible) {
    if (typeof element.containerId !== "string" || typeof element.text !== "string") continue;
    const text = labels.get(element.containerId) ?? [];
    labels.set(element.containerId, [...text, element.text]);
  }
  const elements = visible.map((element) => {
    if (typeof element.id !== "string" || typeof element.type !== "string")
      throw new Error("This drawing contains an invalid element.");
    const result: Record<string, unknown> = { id: element.id, type: element.type };
    for (const key of STRINGS) if (typeof element[key] === "string") result[key] = element[key];
    for (const key of NUMBERS) if (typeof element[key] === "number") result[key] = element[key];
    const boundText = labels.get(element.id);
    if (boundText) result.label = boundText.join("\n");
    if (Array.isArray(element.groupIds))
      result.groupIds = element.groupIds.filter((id: unknown) => typeof id === "string");
    if (element.type === "arrow" || element.type === "line") {
      if (Array.isArray(element.points))
        result.points = element.points.filter(
          (point: unknown) =>
            Array.isArray(point) && point.length === 2 && point.every((value: unknown) => typeof value === "number"),
        );
      for (const end of ["start", "end"]) {
        const binding = element[`${end}Binding`];
        const arrowhead = element[`${end}Arrowhead`];
        const endpoint: Record<string, unknown> = { arrowhead: typeof arrowhead === "string" ? arrowhead : null };
        if (isRecord(binding) && typeof binding.elementId === "string") {
          endpoint.elementId = binding.elementId;
          const label = labels.get(binding.elementId);
          if (label) endpoint.label = label.join("\n");
        }
        result[end] = endpoint;
      }
    }
    if (element.type === "image") {
      if (typeof element.fileId === "string") result.fileId = element.fileId;
      const file = typeof element.fileId === "string" ? files[element.fileId] : null;
      if (isRecord(file) && typeof file.mimeType === "string") result.mimeType = file.mimeType;
    }
    return result;
  });
  return [
    "Format: Excalidraw drawing",
    `Visible elements: ${elements.length}`,
    "Coordinates are scene pixels: x increases rightward and y downward. Width and height describe bounds; angle is in radians. Connector points are relative to their x/y origin. An arrowhead at end points from start to end; bindings name connected elements. Labels come from text bound to a shape. Shared groupIds and frameId describe grouping.",
    withImage ? BESIDE_IMAGE : STRUCTURE_ONLY,
    JSON.stringify({ elements }),
  ].join("\n\n");
}
