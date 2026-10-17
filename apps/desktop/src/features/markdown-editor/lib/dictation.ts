import { Prec, StateEffect, StateField, Transaction, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { createElement } from "react";
import { hotkeyFor } from "../../../entities/settings/model/keybindings";
import { cancelDictation, startDictation, stopDictation } from "../../../shared/api/voice";
import { errorMessage } from "../../../shared/lib/error-toast";
import { hotkeyFromEvent, sameHotkey, type Hotkey } from "../../../shared/lib/hotkeys";
import { DictationStatus, type DictationState } from "../ui/dictation-status";
import { ReactWidget } from "./widget-roots";

interface Hold {
  startedAt: number;
  started: Promise<boolean>;
}

const MIN_HOLD_MS = 300;
const FAILURE_MS = 3000;
const MODIFIER_KEYS: [keyof Omit<Hotkey, "key">, string[]][] = [
  ["mod", ["Control", "Meta"]],
  ["alt", ["Alt"]],
  ["shift", ["Shift"]],
];

class DictationWidget extends ReactWidget {
  protected readonly tag = "span";
  protected readonly className = "mx-1 text-[0.85em] text-muted-foreground";

  constructor(
    private readonly state: DictationState,
    private readonly label: string,
  ) {
    super();
  }

  eq(other: DictationWidget) {
    return other.state === this.state && other.label === this.label;
  }

  protected element() {
    return createElement(DictationStatus, { state: this.state, label: this.label });
  }

  ignoreEvent() {
    return true;
  }
}

interface Pending {
  at: number;
  state: DictationState;
  label: string;
}

const setPending = StateEffect.define<Pending | null>();

const pendingField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(pending, transaction) {
    let next = pending.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setPending)) continue;
      next = effect.value
        ? Decoration.set([
            Decoration.widget({
              widget: new DictationWidget(effect.value.state, effect.value.label),
              side: 1,
            }).range(effect.value.at),
          ])
        : Decoration.none;
    }
    return next;
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.editorAttributes.compute([field], (state) => ({
      class: state.field(field).size > 0 ? "cm-dictating" : "",
    })),
  ],
});

const dictatingTheme = EditorView.baseTheme({
  "&.cm-dictating .cm-placeholder, &.cm-dictating .cm-md-slash-hint": { display: "none" },
});

const pendingAt = (state: EditorState): number | null => {
  const cursor = state.field(pendingField).iter();
  return cursor.value ? cursor.from : null;
};

function releasesHotkey(event: KeyboardEvent, hotkey: Hotkey) {
  const modifierReleased = MODIFIER_KEYS.some(([modifier, keys]) => hotkey[modifier] && keys.includes(event.key));
  return modifierReleased || hotkeyFromEvent(event)?.key === hotkey.key;
}

function showPending(view: EditorView, pending: Pending | null) {
  view.dispatch({ effects: setPending.of(pending), annotations: Transaction.addToHistory.of(false) });
}

function insertDictation(view: EditorView, at: number, text: string) {
  const before = at > 0 ? view.state.sliceDoc(at - 1, at) : "";
  const insert = (before && !/\s/.test(before) ? " " : "") + text;
  const { empty, head } = view.state.selection.main;
  view.dispatch({
    changes: { from: at, insert },
    effects: setPending.of(null),
    ...(empty && head === at ? { selection: { anchor: at + insert.length } } : {}),
    userEvent: "input.dictate",
    scrollIntoView: true,
  });
}

export function dictation(): Extension {
  let hold: Hold | null = null;
  let shown = 0;

  const show = (view: EditorView, pending: Pending | null) => {
    shown++;
    showPending(view, pending);
  };

  const fail = (view: EditorView, error: unknown) => {
    const at = view.dom.isConnected ? pendingAt(view.state) : null;
    if (at !== null) show(view, { at, state: "failed", label: errorMessage(error) });
  };

  const clearFailureLater = (view: EditorView) => {
    const failure = shown;
    window.setTimeout(() => {
      if (failure === shown && view.dom.isConnected) show(view, null);
    }, FAILURE_MS);
  };

  const release = async (view: EditorView) => {
    const current = hold;
    if (!current) return;
    hold = null;
    if (!(await current.started)) return clearFailureLater(view);
    if (Date.now() - current.startedAt < MIN_HOLD_MS) {
      void cancelDictation();
      if (view.dom.isConnected) show(view, null);
      return;
    }
    const at = view.dom.isConnected ? pendingAt(view.state) : null;
    if (at !== null) show(view, { at, state: "transcribing", label: "Transcribing" });
    let text: string;
    try {
      text = await stopDictation();
    } catch (e) {
      fail(view, e);
      return clearFailureLater(view);
    }
    const insertAt = view.dom.isConnected ? pendingAt(view.state) : null;
    if (insertAt === null) return;
    if (text) insertDictation(view, insertAt, text);
    else show(view, null);
  };

  return [
    pendingField,
    dictatingTheme,
    Prec.high(
      EditorView.domEventHandlers({
        keydown(event, view) {
          const pressed = hotkeyFromEvent(event);
          if (!pressed || !sameHotkey(pressed, hotkeyFor("dictate"))) return false;
          event.preventDefault();
          if (!hold) {
            show(view, { at: view.state.selection.main.head, state: "recording", label: "Recording" });
            const started = startDictation(() => {}).then(
              () => true,
              (e: unknown) => {
                fail(view, e);
                return false;
              },
            );
            hold = { startedAt: Date.now(), started };
          }
          return true;
        },
        keyup(event, view) {
          if (hold && releasesHotkey(event, hotkeyFor("dictate"))) void release(view);
          return false;
        },
        blur(_event, view) {
          void release(view);
        },
      }),
    ),
  ];
}
