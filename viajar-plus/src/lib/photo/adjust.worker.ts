/// <reference lib="webworker" />
// Worker que aplica os ajustes de cor/nitidez fora da thread principal.
import { applyAdjustments, type Adjustments } from "./ops";

self.onmessage = (e: MessageEvent<{ id: number; width: number; height: number; data: Uint8ClampedArray; adjust: Adjustments }>) => {
  const { id, width, height, data, adjust } = e.data;
  const out = applyAdjustments({ width, height, data }, adjust);
  (self as unknown as Worker).postMessage({ id, data: out.data }, [out.data.buffer]);
};
