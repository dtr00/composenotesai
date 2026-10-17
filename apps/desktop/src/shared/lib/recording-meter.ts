import { createStore, updateStore, type Store } from "./store";

const SECOND_MS = 1000;

export interface MeterReading {
  levels: number[];
  seconds: number;
}

export interface RecordingMeter {
  reading: Store<MeterReading>;
  start: () => void;
  stop: () => void;
  push: (peak: number) => void;
}

export function createRecordingMeter(bars: number): RecordingMeter {
  const silence = (): MeterReading => ({ levels: new Array<number>(bars).fill(0), seconds: 0 });
  const reading = createStore(silence());
  let clock: number | null = null;
  const stop = () => {
    if (clock !== null) window.clearInterval(clock);
    clock = null;
    reading.set(silence());
  };
  return {
    reading,
    stop,
    start() {
      stop();
      clock = window.setInterval(() => updateStore(reading, { seconds: reading.get().seconds + 1 }), SECOND_MS);
    },
    push(peak) {
      if (clock !== null) updateStore(reading, { levels: [...reading.get().levels.slice(1), peak] });
    },
  };
}
