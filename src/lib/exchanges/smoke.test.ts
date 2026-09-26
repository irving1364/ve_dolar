import { describe, it, expect } from "vitest";
import { fetchBinanceDepth, fetchBybitDepth, fetchOkxDepth, validateDepth } from "./index";

const enabled = process.env.RUN_SMOKE === "1";

describe.skipIf(!enabled)("live smoke", () => {
  it(
    "fetches real depths",
    async () => {
      const results = await Promise.allSettled([
        fetchBinanceDepth(),
        fetchBybitDepth(),
        fetchOkxDepth(),
      ]);
      for (const r of results) {
        if (r.status === "rejected") {
          console.warn("REJECTED:", r.reason?.message ?? r.reason);
          continue;
        }
        const d = r.value;
        console.log(
          `${d.exchange}: buy=${d.buyPrice} sell=${d.sellPrice} avg=${d.avgPrice} volB=${d.buyVolume} volS=${d.sellVolume}`
        );
        if (!validateDepth(d, d.avgPrice || 800)) {
          throw new Error(
            `${d.exchange} INVALID: buy=${d.buyPrice} sell=${d.sellPrice} avg=${d.avgPrice}`
          );
        }
      }
    },
    60000
  );
});
