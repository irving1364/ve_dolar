import { describe, it, expect } from "vitest";
import { parseVemiMessages } from "./vemi";

function msg(text: string, iso: string) {
  return { text, timestamp: new Date(iso) };
}

describe("parseVemiMessages", () => {
  it("reconoce un banco y una accion de apertura", () => {
    const entries = parseVemiMessages([
      msg("BDV activo compra de divisas maximo 500", "2026-09-18T13:41:50+00:00"),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].bank).toBe("Banco de Venezuela");
  });

  it("extrae la hora mencionada en el texto en vez de la del post", () => {
    const entries = parseVemiMessages([
      msg(
        "Banco Mercantil abrió por segundos a las 8:30am intervención electrónica para persona natural",
        "2026-09-23T13:15:00+00:00"
      ),
    ]);
    expect(entries[0].bank).toBe("Mercantil");
    expect(entries[0].mechanism).toBe("Intervencion Electronica");
    expect(entries[0].time).toBe("08:30 AM");
  });

  it("ignora mensajes sin banco reconocido o sin verbo de accion", () => {
    const entries = parseVemiMessages([
      msg("🚨 Pasando los 849 Viernes, 18 de Septiembre 2026", "2026-09-18T23:31:23+00:00"),
      msg("Todos los bancos siguen operando con normalidad", "2026-09-18T23:32:00+00:00"),
    ]);
    expect(entries).toHaveLength(0);
  });

  it("excluye alertas de estafa aunque mencionen un banco y un verbo de accion", () => {
    const entries = parseVemiMessages([
      msg(
        "ALERTA Nuevas estafas en circulación con Banco de Venezuela, no abras enlaces sospechosos",
        "2026-09-24T10:00:00+00:00"
      ),
    ]);
    expect(entries).toHaveLength(0);
  });

  it("reconoce variantes con palabras como aprobando/liberando/abierta", () => {
    const entries = parseVemiMessages([
      msg("BNC aprobando hasta 50$ de la intervención electrónica de hoy", "2026-09-22T14:00:00+00:00"),
      msg("BNC liberando las divisas compradas de las intervenciones de lunes", "2026-09-22T15:00:00+00:00"),
      msg("BNC: Intervención Electrónica Persona Natural abierta", "2026-09-23T12:00:00+00:00"),
    ]);
    expect(entries).toHaveLength(3);
    expect(entries.every((e) => e.bank === "BNC")).toBe(true);
  });
});
