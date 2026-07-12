import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const API_URLS = {
  bcv: "https://dolarflow.com/api/oficial/",
  paralelo: "https://dolarflow.com/api/paralelo/",
};

interface DolarflowResponse {
  exito: boolean;
  precio: number;
  fuente: string;
}

async function fetchRate(source: string, url: string): Promise<void> {
  const res = await fetch(url, {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }

  const data: DolarflowResponse = await res.json();

  if (!data.exito || typeof data.precio !== "number") {
    throw new Error(`Unexpected response from ${url}: ${JSON.stringify(data)}`);
  }

  await prisma.rate.create({
    data: {
      source,
      price: data.precio,
    },
  });
}

export async function GET(): Promise<NextResponse> {
  const results: { source: string; status: string; price?: number }[] = [];

  for (const [source, url] of Object.entries(API_URLS)) {
    try {
      await fetchRate(source, url);
      results.push({ source, status: "ok" });
    } catch (err) {
      console.error(`Failed to fetch ${source}:`, err);
      results.push({
        source,
        status: "error",
        ...(err instanceof Error ? { price: 0 } : {}),
      });
    }
  }

  return NextResponse.json({
    ok: results.every((r) => r.status === "ok"),
    results,
    timestamp: new Date().toISOString(),
  });
}
