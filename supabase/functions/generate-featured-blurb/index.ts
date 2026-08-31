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
import {
  BLURB_MODEL,
  SCENARIO_SELECT,
  generateAndStoreImage,
  generateBlurb,
  getAnthropicKey,
  resolveImagePrompt
} from "../_shared/scenario_image.ts";

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
        .select(SCENARIO_SELECT)
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
        .select(SCENARIO_SELECT)
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
      const built = await generateBlurb(s, anthropicKey, "Featured Scenario", detail);
      blurb = built.blurb;
      aiUsage = built.usage;
    }

    // --- 2. Background image (Wiro) ---
    const { imageUrl, imagePrompt, briefUsage } =
      await generateAndStoreImage(supabase, s, customImagePrompt, weekKey);

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
