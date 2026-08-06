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
//     the image. image_prompt overrides the auto-built Dezgo prompt (used by
//     the "review before regenerating" modal). Not restricted to the
//     recent-10 pool — admin can feature anything.
// Both paths generate a short AI blurb (Anthropic) and a background image
// (Dezgo, Flux 1 via multipart/form-data) and write them into
// featured_case_blurbs.
import { createClient } from "jsr:@supabase/supabase-js@2";

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

// Uses arrival_hx — the crew's third-person description of the patient's
// actual position/appearance/scene on arrival (e.g. "Patient found seated
// at the kitchen table, slumped forward with head resting on her arms") —
// rather than caller_hx, which is written from the CALLER's point of view
// ("Caller is Isabella's housemate who reports...") and was causing the
// image model to render the caller instead of the patient. Falls back to
// dispatch, then title. Explicit instruction not to depict the caller kept
// as a safety net since arrival_hx occasionally still mentions them briefly.
function buildImagePrompt(s: { title?: string; dispatch?: string; arrival_hx?: string; caller_hx?: string }) {
  const clinicalPicture = s.arrival_hx || s.dispatch || s.title || "a medical emergency";
  return (
    `Photorealistic photo of the patient described here: ${clinicalPicture} ` +
    `Depict the patient and their immediate surroundings — not the person who called for help. ` +
    `Cinematic lighting, wide shot, professional editorial photography style, shallow depth of field.`
  );
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
      if (typeof body?.image_prompt === "string" && body.image_prompt.trim()) {
        customImagePrompt = body.image_prompt.trim().slice(0, 1000); // Dezgo's own prompt length limit
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
        .select("id, title, category, subcategory, subtitle, dispatch, arrival_hx, caller_hx")
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
        .select("id, title, category, subcategory, subtitle, dispatch, arrival_hx, caller_hx")
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
      // Same source the client uses (getAnthropicKeyForKQ in scenario.html).
      const { data: cfg, error: cfgErr } = await supabase
        .from("app_config")
        .select("value")
        .eq("key", "anthropic_api_key")
        .maybeSingle();
      if (cfgErr) throw cfgErr;
      const anthropicKey = cfg?.value;
      if (!anthropicKey) throw new Error("anthropic_api_key not found in app_config");

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
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

    // --- 2. Background image (Dezgo) ---
    const dezgoKey = Deno.env.get("DEZGO_API_KEY");
    let imageUrl: string | null = null;
    if (dezgoKey) {
      try {
        const prompt = customImagePrompt || buildImagePrompt(s);
        const formData = new FormData();
        formData.append("prompt", prompt);
        formData.append("width", "1024");
        formData.append("height", "768");
        formData.append("steps", "20");
        formData.append("format", "png");
        const imgRes = await fetch("https://api.dezgo.com/text2image_flux", {
          method: "POST",
          headers: {
            "X-Dezgo-Key": dezgoKey
          },
          body: formData
        });
        if (!imgRes.ok) {
          const errText = await imgRes.text().catch(() => "");
          console.error("Dezgo error:", imgRes.status, errText.slice(0, 500));
        } else {
          const contentType = imgRes.headers.get("content-type") || "";
          if (contentType.includes("json")) {
            const errText = await imgRes.text().catch(() => "");
            console.error("Dezgo returned JSON instead of an image:", errText.slice(0, 500));
          } else {
            const bytes = new Uint8Array(await imgRes.arrayBuffer());
            const path = `${weekKey}/${s.id}-${Date.now()}.png`;
            const { error: uploadErr } = await supabase.storage
              .from("featured-scenario-images")
              .upload(path, bytes, { contentType: "image/png", upsert: true });
            if (uploadErr) {
              console.error("Storage upload error:", uploadErr);
            } else {
              const { data: pub } = supabase.storage.from("featured-scenario-images").getPublicUrl(path);
              imageUrl = pub.publicUrl;
            }
          }
        }
      } catch (imgErr) {
        console.error("Image generation failed (non-fatal):", imgErr);
      }
    } else {
      console.warn("DEZGO_API_KEY not set — skipping image generation");
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
      model: "claude-haiku-4-5-20251001",
      input_tokens: aiUsage?.input_tokens ?? 0,
      output_tokens: aiUsage?.output_tokens ?? 0,
      label: `Featured scenario ${imageOnly ? "image regen" : "blurb"}${imageUrl ? " + image" : ""} (${isCron ? "auto" : "manual"}) — ${s.title || s.id}`
    });

    return json({ ok: true, weekKey, scenarioId: s.id, blurb, imageUrl });
  } catch (err) {
    console.error("generate-featured-blurb failed:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
