import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { assertAiBudget, recordAiCall } from "./budget";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

type Admin = SupabaseClient<Database>;

export interface GeminiOpts {
  admin: Admin;
  systemInstruction?: string;
  /** OpenAPI-ish schema object for structured output */
  responseSchema?: Record<string, any>;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export class GeminiError extends Error {}

/**
 * Single-shot Gemini call that returns parsed JSON. Enforces the daily
 * free-tier budget via the ai_usage table before spending a call.
 */
export async function geminiJson<T = any>(prompt: string, opts: GeminiOpts): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set");

  await assertAiBudget(opts.admin);

  const body: Record<string, any> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.1,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
      responseMimeType: "application/json",
      ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
    },
  };
  if (opts.systemInstruction) {
    body.systemInstruction = { parts: [{ text: opts.systemInstruction }] };
  }

  let res: Response;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (res.status === 429 && attempt < 2) {
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      continue;
    }
    break;
  }

  await recordAiCall(opts.admin);

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new GeminiError(`Gemini ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text)
    .join("");
  if (!text) throw new GeminiError("empty Gemini response");

  try {
    return JSON.parse(text) as T;
  } catch {
    // occasionally wrapped in ```json fences despite responseMimeType
    const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new GeminiError("could not parse Gemini JSON output");
  }
}
