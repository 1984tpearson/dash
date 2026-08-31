// Shared by generate-featured-blurb and generate-popular-blurb.
//
// These two functions do the same job for two different homepage cards, and
// the halves that are not card-specific — writing the image brief, calling
// Wiro, storing the result, and the teaser prompt itself — were hand-copied
// between them. generate-popular-blurb's own comment said so ("Mirrors
// buildImagePrompt() in generate-featured-blurb"), and the copies had already
// drifted apart before this file existed. What stays per-function is what
// genuinely differs: how the target scenario is chosen, which table the
// result is written to, the storage path prefix, and the card's name.
import { createClient } from "jsr:@supabase/supabase-js@2";

export type SupabaseClient = ReturnType<typeof createClient>;

export const BLURB_MODEL = "claude-haiku-4-5-20251001";

export type Scenario = {
  id?: string;
  title?: string;
  category?: string;
  subcategory?: string;
  subtitle?: string;
  dispatch?: string;
  arrival_hx?: string;
  caller_hx?: string;
  patient_meta?: Record<string, unknown>;
  vitals?: Record<string, unknown>;
};

export async function getAnthropicKey(supabase: SupabaseClient) {
  // Same source the client uses (getAnthropicKeyForKQ in index.html).
  const { data: cfg, error: cfgErr } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "anthropic_api_key")
    .maybeSingle();
  if (cfgErr) throw cfgErr;
  const key = cfg?.value;
  if (!key) throw new Error("anthropic_api_key not found in app_config");
  return key as string;
}

// Turns the scenario into a brief a camera could actually shoot. This is a
// separate AI call rather than something built by string concatenation
// because the source material is a clinical handover, and the two are not the
// same kind of writing at all:
//
//  - Most of arrival_hx is unphotographable. "Wife states", "no known
//    psychiatric history", "not himself for the past two days" describe a
//    history, not a moment, and only dilute the handful of words that are
//    actually an image.
//  - Its negations were actively harmful. Diffusion models do not negate, so
//    "denies any witnessed seizure activity, recent head trauma" simply put
//    'seizure' and 'head trauma' into the prompt — the old prompt was asking
//    for the injuries the scenario says are absent.
//  - It routinely features the caller. The old prompt pasted the wife in and
//    then appended "not the person who called for help" to argue with itself;
//    leaving her out of the brief in the first place is the real fix, and is
//    why that trailing instruction is gone.
//  - It spans time (two days of illness, 90 minutes since found) where a
//    photograph is one instant, and nothing said which instant.
//  - The person was missing entirely. patient_meta has age, gender and
//    ethnicity and none of it reached the image — hence both being selected
//    now and being handed over as the first thing in the brief.
//
// The old "cinematic lighting / editorial / shallow depth of field" tail is
// deliberately not reinstated here: that keyword-stuffing is what produced
// the over-produced stock-photo gloss that reads as AI-generated.
export const IMAGE_BRIEF_PROMPT =
  'You turn a clinical training scenario into a short brief for a photographer. ' +
  'Describe ONE still photograph of the patient at the moment the crew arrives.\n\n' +
  'Rules:\n' +
  '- Open with the person: approximate age, sex, build, and what they are wearing. Infer clothing from the situation (someone found after going to bed is in sleepwear).\n' +
  '- Then their posture and expression at this instant, then the room around them and the light in it.\n' +
  '- Describe only what a camera in that room would see. No history, no symptoms that are not visible, no what anyone said, no diagnosis, no vital signs, no medical equipment unless the scenario puts it there.\n' +
  '- The patient is ALONE in the frame. Never mention family, bystanders, callers or paramedics.\n' +
  '- Describe only what IS in the picture. Never state that something is absent, normal, ruled out or denied — an image model cannot render an absence, and naming one puts it in the picture.\n' +
  '- Plain declarative sentences, one paragraph, under 70 words. No camera brands, no lens specs, no photography style words, no artistic adjectives.\n' +
  '- Output the brief only. No preamble, no quotation marks.';

export function briefSourceFor(s: Scenario) {
  const pm = (s.patient_meta || {}) as Record<string, string>;
  const timeOfDay = (s.vitals as Record<string, string> | undefined)?.TimeOfDay;
  const lines = [
    pm.age ? `Patient age: ${pm.age}` : "",
    pm.gender ? `Patient sex: ${pm.gender}` : "",
    pm.ethnicity ? `Patient ethnicity: ${pm.ethnicity}` : "",
    timeOfDay ? `Time of day: ${timeOfDay}` : "",
    s.title ? `Scenario: ${s.title}` : "",
    s.dispatch ? `Dispatch: ${s.dispatch}` : "",
    s.arrival_hx ? `Scene on arrival: ${s.arrival_hx}` : ""
  ].filter(Boolean);
  return lines.join("\n");
}

// Fallback for when the brief call fails — deliberately demographics-led and
// stripped back to the one sentence that describes the scene, rather than the
// whole handover. Worse than the AI brief, but it is a photograph of a person
// rather than a paragraph of negations.
export function buildFallbackImagePrompt(s: Scenario) {
  const pm = (s.patient_meta || {}) as Record<string, string>;
  const who = [pm.age ? `${pm.age}` : "", pm.gender || "person"].filter(Boolean).join(" ").trim();
  const scene = (s.arrival_hx || s.dispatch || s.title || "a medical emergency").split(/(?<=[.!?])\s/)[0];
  return `A photograph of a ${who || "person"} alone in the frame. ${scene}`;
}

export async function buildImageBrief(s: Scenario, anthropicKey: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: BLURB_MODEL,
      max_tokens: 300,
      system: IMAGE_BRIEF_PROMPT,
      messages: [{ role: "user", content: `${briefSourceFor(s)}\n\nWrite the photograph brief now.` }]
    })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error?.message || `Anthropic API error ${res.status}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error("AI returned an empty image brief");
  return { prompt: text, usage: data.usage || null };
}

// Never throws: a brief that could not be written falls back rather than
// costing the caller their blurb, matching how a failed image already behaves.
export async function resolveImagePrompt(s: Scenario, supabase: SupabaseClient) {
  try {
    const key = await getAnthropicKey(supabase);
    return await buildImageBrief(s, key);
  } catch (err) {
    console.error("Image brief generation failed — falling back:", err);
    return { prompt: buildFallbackImagePrompt(s), usage: null };
  }
}

// --- Wiro image generation ---------------------------------------------
// Wiro's Run route is ASYNCHRONOUS: it returns { taskid, socketaccesstoken }
// immediately and the image arrives later, unlike Dezgo (which this replaced)
// which returned the PNG bytes in the same response. Results can be collected
// by polling, websocket, or a callbackUrl; polling is used here because the
// caller is a human waiting on the "Regenerate Image" modal for a single
// image — a callback would need a second function and a round trip back to
// the browser to tell it the picture had landed.
const WIRO_RUN_BASE = "https://api.wiro.ai/v1/Run";
const WIRO_TASK_DETAIL = "https://api.wiro.ai/v1/Task/Detail";
const WIRO_POLL_INTERVAL_MS = 1500;
const WIRO_POLL_TIMEOUT_MS = 90000;

// The model lives in the Run URL (/v1/Run/<owner>/<model>) — there is no
// account default — so one has to be named here. WIRO_IMAGE_MODEL overrides
// it, which is what makes trying a different model a secret rather than a
// deploy; unset, this is what runs.
const WIRO_DEFAULT_MODEL = "bytedance/seedream-v5-pro";

// Seedream takes a resolution tier and an aspect ratio rather than explicit
// pixel dimensions. 4:3 matches the card's own aspect-ratio, and 1k (1152x864)
// is already more than a background behind text needs — 2k costs more for
// pixels the card never shows. Merged over by WIRO_IMAGE_PARAMS, since a
// different model will want different keys entirely.
const WIRO_DEFAULT_PARAMS: Record<string, unknown> = {
  resolution: "1k",
  aspectRatio: "4:3",
  outputFormat: "jpeg",
  watermark: "false"
};

// Terminal statuses, per Wiro's task-status list. Anything else (task_queue,
// task_accept, task_assign, task_preprocess_*, task_start, task_output) means
// still running, so polling continues.
const WIRO_STATUS_DONE = "task_postprocess_end";
const WIRO_STATUS_CANCELLED = "task_cancel";

// Signature auth: hex HMAC-SHA256 over (secret + nonce), keyed with the API
// key. Wiro projects come in two flavours — API-Key-Only sends just the key,
// Signature projects additionally require x-nonce and x-signature — so the
// secret's presence is what selects between them.
async function wiroSignature(apiKey: string, secret: string, nonce: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(apiKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(secret + nonce));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Deliberately sets no Content-Type. Wiro reads form FIELDS, and the body is
// a FormData, so fetch has to write the header itself — a multipart type
// without the boundary fetch generates is unparseable.
//
// Wiro's own curl example is self-contradictory here: it sends a JSON string
// body under a hand-set multipart/form-data header, which is not multipart at
// all. Copying it verbatim produced "Request parameter [prompt] required" for
// every required field — nothing was parsed. Don't reinstate a hand-set
// Content-Type on these requests.
async function wiroHeaders(apiKey: string) {
  const headers: Record<string, string> = { "x-api-key": apiKey };
  const secret = Deno.env.get("WIRO_API_SECRET");
  if (secret) {
    const nonce = String(Math.floor(Date.now() / 1000));
    headers["x-nonce"] = nonce;
    headers["x-signature"] = await wiroSignature(apiKey, secret, nonce);
  }
  return headers;
}

// Every value goes over as a string — these are form fields, so booleans like
// watermark travel as "false", not false.
function wiroForm(fields: Record<string, unknown>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) form.append(k, String(v));
  }
  return form;
}

export type WiroImage = { bytes: Uint8Array; contentType: string; ext: string };

function extFor(contentType: string) {
  return contentType === "image/jpeg" ? "jpg"
    : contentType === "image/webp" ? "webp"
    : "png";
}

export async function generateWiroImage(prompt: string): Promise<WiroImage | null> {
  const apiKey = Deno.env.get("WIRO_API_KEY");
  if (!apiKey) {
    console.warn("WIRO_API_KEY not set — skipping image generation");
    return null;
  }
  const model = Deno.env.get("WIRO_IMAGE_MODEL") || WIRO_DEFAULT_MODEL;

  let extraParams: Record<string, unknown> = {};
  const rawParams = Deno.env.get("WIRO_IMAGE_PARAMS");
  if (rawParams) {
    try {
      const parsed = JSON.parse(rawParams);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) extraParams = parsed;
      else console.error("WIRO_IMAGE_PARAMS is not a JSON object — ignoring");
    } catch {
      console.error("WIRO_IMAGE_PARAMS is not valid JSON — ignoring");
    }
  }

  const headers = await wiroHeaders(apiKey);
  // No inputImage: this is text-to-image. Passing one would make Seedream
  // edit that picture instead of generating a new one.
  const runRes = await fetch(`${WIRO_RUN_BASE}/${model}`, {
    method: "POST",
    headers,
    body: wiroForm({ ...WIRO_DEFAULT_PARAMS, ...extraParams, prompt })
  });
  if (!runRes.ok) {
    console.error("Wiro run error:", runRes.status, (await runRes.text().catch(() => "")).slice(0, 500));
    return null;
  }
  const run = await runRes.json();
  if (run?.errors?.length) console.error("Wiro run reported errors:", JSON.stringify(run.errors).slice(0, 500));
  const taskid = run?.taskid;
  if (!taskid) {
    console.error("Wiro run returned no taskid:", JSON.stringify(run).slice(0, 500));
    return null;
  }

  const deadline = Date.now() + WIRO_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, WIRO_POLL_INTERVAL_MS));
    // Each poll re-signs: the nonce must be fresh, so headers cannot be
    // hoisted out of the loop on a signature project.
    const detailRes = await fetch(WIRO_TASK_DETAIL, {
      method: "POST",
      headers: await wiroHeaders(apiKey),
      body: wiroForm({ taskid })
    });
    if (!detailRes.ok) {
      console.error("Wiro task detail error:", detailRes.status);
      continue;
    }
    const detail = await detailRes.json();
    const task = detail?.tasklist?.[0];
    const status = task?.status;
    if (status === WIRO_STATUS_CANCELLED) {
      console.error("Wiro task was cancelled:", JSON.stringify(task?.debugerror || detail).slice(0, 500));
      return null;
    }
    if (status !== WIRO_STATUS_DONE) continue;

    // Terminal and successful — an output is expected from here, so a missing
    // one is a real failure rather than a reason to keep waiting.
    const output = task?.outputs?.[0];
    if (!output?.url) {
      console.error("Wiro task finished with no output URL:", JSON.stringify(task).slice(0, 500));
      return null;
    }
    const fileRes = await fetch(output.url);
    if (!fileRes.ok) {
      console.error("Wiro output fetch failed:", fileRes.status, output.url);
      return null;
    }
    // Prefer the task's own contenttype over the CDN response header — it is
    // what Wiro says it produced, and outputFormat is ours to set.
    const contentType = (output.contenttype
      || fileRes.headers.get("content-type")
      || "image/png").split(";")[0].trim();
    return { bytes: new Uint8Array(await fileRes.arrayBuffer()), contentType, ext: extFor(contentType) };
  }
  console.error(`Wiro task ${taskid} did not complete within ${WIRO_POLL_TIMEOUT_MS}ms`);
  return null;
}

// The whole image half of a card's generation: write the brief, ask Wiro,
// store the PNG, hand back the public URL. Never throws — a failed image has
// always been non-fatal here, since the blurb is still worth saving and the
// card falls back to its plain (image-less) styling.
export async function generateAndStoreImage(
  supabase: SupabaseClient,
  s: Scenario,
  customImagePrompt: string | null,
  pathPrefix: string
) {
  let imageUrl: string | null = null;
  let imagePrompt = "";
  let briefUsage: { input_tokens?: number; output_tokens?: number } | null = null;
  try {
    if (customImagePrompt) {
      imagePrompt = customImagePrompt;
    } else {
      const built = await resolveImagePrompt(s, supabase);
      imagePrompt = built.prompt;
      briefUsage = built.usage;
    }
    const img = await generateWiroImage(imagePrompt);
    if (img) {
      const path = `${pathPrefix}/${s.id}-${Date.now()}.${img.ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("featured-scenario-images")
        .upload(path, img.bytes, { contentType: img.contentType, upsert: true });
      if (uploadErr) {
        console.error("Storage upload error:", uploadErr);
      } else {
        const { data: pub } = supabase.storage.from("featured-scenario-images").getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }
    }
  } catch (imgErr) {
    console.error("Image generation failed (non-fatal):", imgErr);
  }
  return { imageUrl, imagePrompt, briefUsage };
}

// The card's teaser. cardName is the only thing that differed between the two
// copies of this prompt ("Featured Scenario" vs "Most Popular Scenario").
export async function generateBlurb(
  s: Scenario,
  anthropicKey: string,
  cardName: string,
  detail: string
) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: BLURB_MODEL,
      max_tokens: 200,
      system:
        `You write a short, punchy teaser (2 sentences), shown on a homepage "${cardName}" card for clinical instructors and educators browsing the scenario library. ` +
        'Write it as a vivid, standalone description of the patient and what\'s happening to them — like a case summary someone would tell a colleague. ' +
        'Do NOT reference the assessment, the learner/student, or what needs to be figured out/managed/determined in any form — no "assess", "determine the cause", "learners must", "requires quick thinking", or similar framing. ' +
        'Just describe the case itself. Never address the reader as "you". Plain text only, no markdown, no quotation marks. Under 40 words total. Do not invent clinical details not implied by what is given.',
      messages: [
        {
          role: "user",
          content:
            `Scenario title: ${s.title || "Untitled"}\nCategory: ${s.category || ""} / ${s.subcategory || ""}\n` +
            (detail ? `Existing dispatch/case detail: ${detail}\n` : "") +
            `Write the teaser now.`
        }
      ]
    })
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error?.message || `Anthropic API error ${res.status}`);
  }
  const data = await res.json();
  const blurb = (data.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("")
    .trim();
  if (!blurb) throw new Error("AI returned an empty blurb");
  return { blurb, usage: data.usage || null };
}

export const SCENARIO_SELECT =
  "id, title, category, subcategory, subtitle, dispatch, arrival_hx, caller_hx, patient_meta, vitals";
