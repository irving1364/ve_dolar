import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchBinanceDepth } from "./binance";
import { fetchBybitDepth } from "./bybit";
import { fetchOkxDepth } from "./okx";
import { validateDepth } from "./index";
import { getEnabledExchanges } from "./types";

const okResponse = (data: unknown) =>
  ({ ok: true, json: async () => data }) as Response;

function parseBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body) return {};
  try {
    return JSON.parse(String(init.body));
  } catch {
    return {};
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.P2P_EXCHANGES;
});

describe("fetchBinanceDepth", () => {
  beforeEach(() => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (!url.includes("p2p.binance.com")) {
          return okResponse({ success: false, data: [] });
        }
        const body = parseBody(init);
        const page = Number(body.page ?? 1);
        if (page > 1) return okResponse({ success: true, data: [] });
        const tradeType = String(body.tradeType);
        return okResponse({
          success: true,
          data:
            tradeType === "BUY"
              ? [
                  { adv: { price: "850", surplusAmount: "100" } },
                  { adv: { price: "860", surplusAmount: "50" } },
                ]
              : [
                  { adv: { price: "840", surplusAmount: "200" } },
                  { adv: { price: "845", surplusAmount: "300" } },
                ],
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  it("consulta ambos lados y normaliza precios/volúmenes", async () => {
    const d = await fetchBinanceDepth();
    expect(d.exchange).toBe("binance");
    expect(d.buyPrice).toBe(840); // mejor precio vendedor (compra USDT)
    expect(d.sellPrice).toBe(860); // mejor precio comprador (venta USDT)
    expect(d.buyVolume).toBe(500); // volumen del lado vendedor
    expect(d.sellVolume).toBe(150); // volumen del lado comprador
    expect(d.avgPrice).toBe(850);
  });

  it("envía el body correcto (USDT/VES, merchant, rows 20)", async () => {
    await fetchBinanceDepth();
    const fetchMock = vi.mocked(fetch);
    const call = fetchMock.mock.calls[0];
    const body = parseBody(call[1]);
    expect(body.asset).toBe("USDT");
    expect(body.fiat).toBe("VES");
    expect(body.rows).toBe(20);
    expect(body.publisherType).toBe("merchant");
    expect(["BUY", "SELL"]).toContain(body.tradeType);
  });
});

describe("fetchBybitDepth", () => {
  beforeEach(() => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (!url.includes("api2.bybit.com")) {
          return okResponse({});
        }
        const body = parseBody(init);
        const side = String(body.side);
        return okResponse({
          ret_code: 0,
          result: {
            items:
              side === "0"
                ? [
                    { price: "850", lastQuantity: "100" },
                    { price: "860", lastQuantity: "50" },
                  ]
                : [
                    { price: "840", lastQuantity: "200" },
                    { price: "845", lastQuantity: "300" },
                  ],
          },
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  it("normaliza precios y volúmenes de Bybit", async () => {
    const d = await fetchBybitDepth();
    expect(d.exchange).toBe("bybit");
    expect(d.buyPrice).toBe(840);
    expect(d.sellPrice).toBe(860);
    expect(d.buyVolume).toBe(500);
    expect(d.sellVolume).toBe(150);
  });

  it("lanza error si el endpoint no responde", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500 }) as Response)
    );
    await expect(fetchBybitDepth()).rejects.toThrow(/HTTP 500/);
  });
});

describe("fetchOkxDepth", () => {
  beforeEach(() => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL) => {
        const url = String(input);
        if (!url.includes("www.okx.com")) return okResponse({});
        const side = url.includes("side=sell") ? "sell" : "buy";
        return okResponse({
          code: "0",
          data: {
            sell: [
              { price: "840", availableAmount: "200" },
              { price: "845", availableAmount: "300" },
            ],
            buy: [
              { price: "850", availableAmount: "100" },
              { price: "860", availableAmount: "50" },
            ],
          },
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  it("normaliza el libro C2C de OKX", async () => {
    const d = await fetchOkxDepth();
    expect(d.exchange).toBe("okx");
    expect(d.buyPrice).toBe(840);
    expect(d.sellPrice).toBe(860);
    expect(d.buyVolume).toBe(500);
    expect(d.sellVolume).toBe(150);
  });

  it("solicita quoteCurrency VES y baseCurrency USDT", async () => {
    await fetchOkxDepth();
    const url = String(vi.mocked(fetch).mock.calls[0][0]);
    expect(url).toContain("quoteCurrency=VES");
    expect(url).toContain("baseCurrency=USDT");
  });
});

describe("validateDepth", () => {
  const base = {
    exchange: "binance" as const,
    buyPrice: 850,
    sellPrice: 860,
    buyVolume: 100,
    sellVolume: 200,
    avgPrice: 855,
  };

  it("acepta precios dentro de ±50% de la referencia", () => {
    expect(validateDepth(base, 855)).toBe(true);
    expect(validateDepth({ ...base, buyPrice: 855 * 0.5 }, 855)).toBe(true);
    expect(validateDepth({ ...base, sellPrice: 855 * 1.5 }, 855)).toBe(true);
  });

  it("rechaza precios fuera de rango o no positivos", () => {
    expect(validateDepth({ ...base, buyPrice: 855 * 0.49 }, 855)).toBe(false);
    expect(validateDepth({ ...base, sellPrice: 855 * 1.51 }, 855)).toBe(false);
    expect(validateDepth({ ...base, buyPrice: 0 }, 855)).toBe(false);
    expect(validateDepth({ ...base, sellPrice: NaN }, 855)).toBe(false);
  });

  it("solo valida positividad si no hay referencia", () => {
    expect(validateDepth(base, 0)).toBe(true);
    expect(validateDepth({ ...base, buyPrice: 1 }, 0)).toBe(true);
    expect(validateDepth({ ...base, buyPrice: 0 }, 0)).toBe(false);
  });
});

describe("getEnabledExchanges", () => {
  it("devuelve todos los exchanges si no hay env", () => {
    expect(getEnabledExchanges()).toEqual(["binance", "bybit", "okx"]);
  });

  it("filtra según P2P_EXCHANGES e ignora valores inválidos", () => {
    process.env.P2P_EXCHANGES = "binance, OKX, kucoin";
    expect(getEnabledExchanges()).toEqual(["binance", "okx"]);
  });
});
