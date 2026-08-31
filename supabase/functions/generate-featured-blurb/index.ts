// generate-featured-blurb
// Two ways to trigger this:
//  1. Weekly cron (pg_cron -> net.http_post, header x-cron-secret) — auto-picks
//     from the 10 most recently generated scenarios (deterministic weekly
//     rotation within that pool), and skips if a blurb already exists for
//     the week (never overwrites a manual pick).
//  2. Admin action from scenario.html "Mark as Featured Scenario" / "Generate
//     AI blurb" / "Regenerate image" buttons — Authorization: Bearer <user JWT>,
//     body { scenario_id, image_only?, image_prompt? }. image_only=true keeps
//     the existing blurb for that scenario/week (if any) and only rerolls
//     the image. image_prompt overrides the auto-built image prompt (used by
//     the "review before regenerating" modal). Not restricted to the
//     recent-10 pool — admin can feature anything.
// Both paths generate a short AI blurb (Anthropic) and a background image
// (Wiro) and write them into featured_case_blurbs.
import { createClient } from "jsr:@supabase/supabase-js@2";

const BLURB_MODEL = "claude-haiku-4-5-20251001";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

function getWeekKey(now: Date) {
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    (((now.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7
  );
  return { weekKey: `${now.getFullYear()}-W${weekNum}`, weekNum };
}

type Scenario = {
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

async function getAnthropicKey(supabase: ReturnType<typeof createClient>) {
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
const IMAGE_BRIEF_PROMPT =
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

function briefSourceFor(s: Scenario) {
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
function buildFallbackImagePrompt(s: Scenario) {
  const pm = (s.patient_meta || {}) as Record<string, string>;
  const who = [pm.age ? `${pm.age}` : "", pm.gender || "person"].filter(Boolean).join(" ").trim();
  const scene = (s.arrival_hx || s.dispatch || s.title || "a medical emergency").split(/(?<=[.!?])\s/)[0];
  return `A photograph of a ${who || "person"} alone in the frame. ${scene}`;
}

async function buildImageBrief(s: Scenario, anthropicKey: string) {
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
async function resolveImagePrompt(s: Scenario, supabase: ReturnType<typeof createClient>) {
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
//
// Auth: use an API-Key-Only Wiro project. Signature projects additionally
// require x-nonce/x-signature per request, which buys nothing here — the key
// never leaves the edge function, so there is no client-side exposure for a
// signature to protect against.
const WIRO_RUN_BASE = "https://api.wiro.ai/v1/Run";
const WIRO_TASK_DETAIL = "https://api.wiro.ai/v1/Task/Detail";
const WIRO_POLL_INTERVAL_MS = 1500;
const WIRO_POLL_TIMEOUT_MS = 90000;

// Pulls the first image URL out of a completed task payload. Wiro's task
// detail shape varies by model, so on a miss the whole payload is logged
// rather than guessed at — one real run then tells you the exact shape to
// read, which is faster than defending against every possible one.
function firstImageUrl(payload: unknown): string | null {
  const seen = new Set<unknown>();
  const walk = (node: unknown): string | null => {
    if (typeof node === "string") {
      return /^https?:\/\/\S+\.(png|jpe?g|webp)(\?|$)/i.test(node) ? node : null;
    }
    if (!node || typeof node !== "object" || seen.has(node)) return null;
    seen.add(node);
    for (const v of Object.values(node as Record<string, unknown>)) {
      const hit = walk(v);
      if (hit) return hit;
    }
    return null;
  };
  return walk(payload);
}

type WiroImage = { bytes: Uint8Array; contentType: string; ext: string };

async function generateWiroImage(prompt: string): Promise<WiroImage | null> {
  const apiKey = Deno.env.get("WIRO_API_KEY");
  const model = Deno.env.get("WIRO_IMAGE_MODEL"); // "<owner-slug>/<model-slug>"
  if (!apiKey || !model) {
    console.warn("WIRO_API_KEY / WIRO_IMAGE_MODEL not set — skipping image generation");
    return null;
  }
  const headers = { "Content-Type": "application/json", "x-api-key": apiKey };

  // Models disagree on how the output size is expressed — FLUX takes
  // width/height, Seedream and Nano Banana take an aspect_ratio — so the
  // non-prompt half of the body is configuration, not code. WIRO_IMAGE_PARAMS
  // is a JSON object merged over the defaults, which makes trying a different
  // model two secrets and no redeploy.
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

  const runRes = await fetch(`${WIRO_RUN_BASE}/${model}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ width: 1024, height: 768, ...extraParams, prompt })
  });
  if (!runRes.ok) {
    console.error("Wiro run error:", runRes.status, (await runRes.text().catch(() => "")).slice(0, 500));
    return null;
  }
  const run = await runRes.json();
  const taskid = run?.taskid || run?.taskId;
  if (!taskid) {
    console.error("Wiro run returned no taskid:", JSON.stringify(run).slice(0, 500));
    return null;
  }

  const deadline = Date.now() + WIRO_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, WIRO_POLL_INTERVAL_MS));
    const detailRes = await fetch(WIRO_TASK_DETAIL, {
      method: "POST",
      headers,
      body: JSON.stringify({ taskid })
    });
    if (!detailRes.ok) {
      console.error("Wiro task detail error:", detailRes.status);
      continue;
    }
    const detail = await detailRes.json();
    const status = String(detail?.status ?? detail?.tasks?.[0]?.status ?? "").toLowerCase();
    if (status.includes("fail") || status.includes("error") || status.includes("cancel")) {
      console.error("Wiro task failed:", JSON.stringify(detail).slice(0, 500));
      return null;
    }
    const url = firstImageUrl(detail);
    if (!url) continue;

    const fileRes = await fetch(url);
    if (!fileRes.ok) {
      console.error("Wiro output fetch failed:", fileRes.status, url);
      return null;
    }
    // The model decides the output format, so the extension/content-type come
    // from what actually came back rather than being assumed to be PNG — a
    // JPEG saved as .png renders fine but is a lie to anything reading the
    // bucket later.
    const contentType = (fileRes.headers.get("content-type") || "image/png").split(";")[0].trim();
    const ext = contentType === "image/jpeg" ? "jpg"
      : contentType === "image/webp" ? "webp"
      : "png";
    return { bytes: new Uint8Array(await fileRes.arrayBuffer()), contentType, ext };
  }
  console.error(`Wiro task ${taskid} did not complete within ${WIRO_POLL_TIMEOUT_MS}ms`);
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // --- Auth: either the cron secret, or an admin's own session ---
    const cronSecret = Deno.env.get("CRON_CHECK_SECRET");
    const providedCronSecret = req.headers.get("x-cron-secret");
    const isCron = !!cronSecret && providedCronSecret === cronSecret;

    let isManual = false;
    let requestedScenarioId: string | null = null;
    let manualUserId: string | null = null;
    let imageOnly = false;
    let promptOnly = false;
    let customImagePrompt: string | null = null;
    if (!isCron) {
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      if (!jwt) return json({ error: "Missing auth" }, 401);

      const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
      if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (profileErr || profile?.role !== "admin") return json({ error: "Admin only" }, 403);

      isManual = true;
      manualUserId = userData.user.id;
      const body = await req.json().catch(() => ({}));
      requestedScenarioId = body?.scenario_id || null;
      imageOnly = !!body?.image_only;
      promptOnly = !!body?.prompt_only;
      if (typeof body?.image_prompt === "string" && body.image_prompt.trim()) {
        customImagePrompt = body.image_prompt.trim().slice(0, 1000);
      }
      if (!requestedScenarioId) return json({ error: "scenario_id required" }, 400);
    }

    const now = new Date();
    const { weekKey, weekNum } = getWeekKey(now);

    // Cron path only: skip if this week is already spoken for (manual or a
    // previous cron run). Manual path always regenerates on request.
    if (isCron) {
      const { data: existing, error: existingErr } = await supabase
        .from("featured_case_blurbs")
        .select("week_key")
        .eq("week_key", weekKey)
        .maybeSingle();
      if (existingErr) throw existingErr;
      if (existing) return json({ skipped: true, reason: "already set", weekKey });
    }

    let s;
    if (isManual) {
      // Admin can feature any scenario by id, regardless of the recent pool.
      const { data: chosen, error: chosenErr } = await supabase
        .from("scenarios")
        .select("id, title, category, subcategory, subtitle, dispatch, arrival_hx, caller_hx, patient_meta, vitals")
        .eq("id", requestedScenarioId)
        .maybeSingle();
      if (chosenErr) throw chosenErr;
      if (!chosen) return json({ error: "Scenario not found" }, 404);
      s = chosen;
    } else {
      // Deterministic weekly rotation, but only within the 10 most recently
      // generated scenarios — same pool logic as the client-side fallback
      // in buildFeaturedCase() (scenario.html).
      const { data: recentPool, error: poolErr } = await supabase
        .from("scenarios")
        .select("id, title, category, subcategory, subtitle, dispatch, arrival_hx, caller_hx, patient_meta, vitals")
        .eq("ai_generated", true)
        .order("created_at", { ascending: false })
        .limit(10);
      if (poolErr) throw poolErr;
      if (!recentPool || recentPool.length === 0) {
        return json({ skipped: true, reason: "no scenarios in recent pool" });
      }
      s = recentPool[weekNum % recentPool.length];
    }

    const detail = s.subtitle || s.dispatch || s.caller_hx || "";

    // prompt_only: build and return the image brief without generating
    // anything. The brief is written by AI now, so the admin's review modal
    // can no longer mirror it client-side the way buildFcImagePrompt() did —
    // it asks for the real one instead, and a hand-copied second version
    // cannot silently drift from what the server actually sends.
    if (promptOnly) {
      const { prompt: previewPrompt } = await resolveImagePrompt(s, supabase);
      return json({ ok: true, imagePrompt: previewPrompt });
    }

    // --- 1. Blurb (Anthropic) — skipped if image_only and a blurb for this
    // scenario/week already exists, so regenerating the image doesn't churn
    // through an API call or change wording the admin was happy with.
    let blurb: string | null = null;
    let aiUsage: { input_tokens?: number; output_tokens?: number } | null = null;

    if (imageOnly) {
      const { data: existingBlurbRow, error: existingBlurbErr } = await supabase
        .from("featured_case_blurbs")
        .select("blurb")
        .eq("week_key", weekKey)
        .eq("scenario_id", s.id)
        .maybeSingle();
      if (existingBlurbErr) throw existingBlurbErr;
      blurb = existingBlurbRow?.blurb || null;
    }

    if (!blurb) {
      const anthropicKey = await getAnthropicKey(supabase);

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
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
            'You write a short, punchy teaser (2 sentences), shown on a homepage "Featured Scenario" card for clinical instructors and educators browsing the scenario library. Write it as a vivid, standalone description of the patient and what\'s happening to them — like a case summary someone would tell a colleague. Do NOT reference the assessment, the learner/student, or what needs to be figured out/managed/determined in any form — no "assess", "determine the cause", "learners must", "requires quick thinking", or similar framing. Just describe the case itself. Never address the reader as "you". Plain text only, no markdown, no quotation marks. Under 40 words total. Do not invent clinical details not implied by what is given.',
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
      if (!aiRes.ok) {
        const e = await aiRes.json().catch(() => ({}));
        throw new Error(e.error?.message || `Anthropic API error ${aiRes.status}`);
      }
      const aiData = await aiRes.json();
      aiUsage = aiData.usage || null;
      blurb = (aiData.content || [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("")
        .trim();
      if (!blurb) throw new Error("AI returned an empty blurb");
    }

    // --- 2. Background image (Wiro) — non-fatal: a failed or unconfigured
    // image generation still saves the blurb, and the card falls back to its
    // plain (image-less) styling.
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
        const path = `${weekKey}/${s.id}-${Date.now()}.${img.ext}`;
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

    // --- 3. Save ---
    const { error: upsertErr } = await supabase
      .from("featured_case_blurbs")
      .upsert({
        week_key: weekKey,
        scenario_id: s.id,
        blurb,
        image_url: imageUrl,
        generated_by: isManual ? manualUserId : null
      });
    if (upsertErr) throw upsertErr;

    await supabase.from("ai_usage_log").insert({
      source: isCron ? "cron-featured-scenario" : "admin-featured-scenario",
      model: BLURB_MODEL,
      input_tokens: (aiUsage?.input_tokens ?? 0) + (briefUsage?.input_tokens ?? 0),
      output_tokens: (aiUsage?.output_tokens ?? 0) + (briefUsage?.output_tokens ?? 0),
      label: `Featured scenario ${imageOnly ? "image regen" : "blurb"}${imageUrl ? " + image" : ""} (${isCron ? "auto" : "manual"}) — ${s.title || s.id}`
    });

    return json({ ok: true, weekKey, scenarioId: s.id, blurb, imageUrl, imagePrompt });
  } catch (err) {
    console.error("generate-featured-blurb failed:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
