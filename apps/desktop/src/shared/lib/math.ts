type Temml = typeof import("temml").default;

let temml: Temml | null = null;
let loading: Promise<Temml> | null = null;

export function loadMath(): Promise<Temml> {
  loading ??= import("temml").then((module) => {
    temml = module.default;
    return temml;
  });
  return loading;
}

function draw(lib: Temml, element: HTMLElement, tex: string, display: boolean) {
  try {
    lib.render(tex, element, { displayMode: display, throwOnError: false, errorColor: "var(--destructive)" });
  } catch {
    element.textContent = tex;
  }
}

export function renderMath(element: HTMLElement, tex: string, display: boolean) {
  if (temml) {
    draw(temml, element, tex, display);
    return;
  }
  element.textContent = tex;
  void loadMath().then((lib) => draw(lib, element, tex, display));
}
