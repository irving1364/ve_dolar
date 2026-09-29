import { describe, it, expect } from "vitest";
import { parseAperturasHtml } from "./aperturas";

const SAMPLE_HTML = `
<ul>
<li class="rounded-xl border border-border/60 bg-secondary/30 p-3.5"><dl class="space-y-1.5"><div class="flex items-baseline justify-between gap-3"><dt class="shrink-0 text-xs text-muted-foreground">Fecha</dt><dd class="text-right text-sm text-foreground "><span class="text-muted-foreground">28/09/2026</span></dd></div><div class="flex items-baseline justify-between gap-3"><dt class="shrink-0 text-xs text-muted-foreground">Banco</dt><dd class="text-right text-sm text-foreground "><span class="font-semibold text-foreground">Provincial</span></dd></div><div class="flex items-baseline justify-between gap-3"><dt class="shrink-0 text-xs text-muted-foreground">Mecanismo</dt><dd class="text-right text-sm text-foreground "><span class="text-foreground">Intervencion Electronica</span></dd></div><div class="flex items-baseline justify-between gap-3"><dt class="shrink-0 text-xs text-muted-foreground">Hora</dt><dd class="text-right text-sm text-foreground "><span class="tabular-nums text-foreground">10:05 AM</span></dd></div><div class="flex items-baseline justify-between gap-3"><dt class="shrink-0 text-xs text-muted-foreground">Duración</dt><dd class="text-right text-sm text-foreground "><span class="tabular-nums text-foreground">1 Hora y 3 minutos</span></dd></div></dl></li>
<li class="rounded-xl border border-border/60 bg-secondary/30 p-3.5"><dl class="space-y-1.5"><div class="flex items-baseline justify-between gap-3"><dt class="shrink-0 text-xs text-muted-foreground">Fecha</dt><dd class="text-right text-sm text-foreground "><span class="text-muted-foreground">27/09/2026</span></dd></div><div class="flex items-baseline justify-between gap-3"><dt class="shrink-0 text-xs text-muted-foreground">Banco</dt><dd class="text-right text-sm text-foreground "><span class="font-semibold text-foreground">100%Banco</span></dd></div><div class="flex items-baseline justify-between gap-3"><dt class="shrink-0 text-xs text-muted-foreground">Mecanismo</dt><dd class="text-right text-sm text-foreground "><span class="text-foreground">Intervencion Electronica</span></dd></div><div class="flex items-baseline justify-between gap-3"><dt class="shrink-0 text-xs text-muted-foreground">Hora</dt><dd class="text-right text-sm text-foreground "><span class="tabular-nums text-foreground">09:30 AM</span></dd></div><div class="flex items-baseline justify-between gap-3"><dt class="shrink-0 text-xs text-muted-foreground">Duración</dt><dd class="text-right text-sm text-foreground "><span class="tabular-nums text-foreground">1 Minuto</span></dd></div></dl></li>
</ul>
`;

describe("parseAperturasHtml", () => {
  it("extrae fecha, banco, mecanismo, hora y duracion de cada tarjeta", () => {
    const entries = parseAperturasHtml(SAMPLE_HTML);
    expect(entries).toHaveLength(2);

    expect(entries[0]).toMatchObject({
      dateStr: "28/09/2026",
      bank: "Provincial",
      mechanism: "Intervencion Electronica",
      time: "10:05 AM",
      duration: "1 Hora y 3 minutos",
    });
    expect(entries[0].date.toISOString()).toBe("2026-09-28T00:00:00.000Z");

    expect(entries[1]).toMatchObject({
      dateStr: "27/09/2026",
      bank: "100%Banco",
      mechanism: "Intervencion Electronica",
      time: "09:30 AM",
      duration: "1 Minuto",
    });
  });

  it("retorna un arreglo vacio si el marcado no coincide", () => {
    expect(parseAperturasHtml("<div>sin datos</div>")).toEqual([]);
  });

  it("ignora tarjetas con menos de 4 campos", () => {
    const broken = `<li><dl><span class="a">28/09/2026</span><span class="b">Provincial</span></dl></li>`;
    expect(parseAperturasHtml(broken)).toEqual([]);
  });
});
