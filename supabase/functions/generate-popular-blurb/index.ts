// generate-popular-blurb
// Same pattern as generate-featured-blurb, but for whichever scenario
// currently has the most favourites (no week rotation — just "today's #1").
// Two ways to trigger:
//  1. Auto-check — client calls with body {} whenever its cached entry's
//     scenario_id doesn't match the current #1. Requires a valid logged-in
//     user session (any role) but the function re-determines the current #1
//     itself server-side via get_popular_scenarios rather than trusting the
//     client, and no-ops if the cache already matches — so a client can't
//     force wasted regenerations by lying about a mismatch.
//  2. Admin manual — body { scenario_id, image_only?, image_prompt? } from an
//     admin session. Same manual-controls pattern as Featured Case's buttons,
//     reserved for if/when those get added to this card too.
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
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Missing auth" }, 401);
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    let isManual = false;
    let requestedScenarioId: string | null = null;
    let imageOnly = false;
    let promptOnly = false;
    let customImagePrompt: string | null = null;

    if (body?.scenario_id) {
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (profileErr || profile?.role !== "admin") return json({ error: "Admin only" }, 403);
      isManual = true;
      requestedScenarioId = body.scenario_id;
      imageOnly = !!body.image_only;
      promptOnly = !!body.prompt_only;
      if (typeof body.image_prompt === "string" && body.image_prompt.trim()) {
        customImagePrompt = body.image_prompt.trim().slice(0, 1000);
      }
    }

    // Determine the target — trust the server's own popularity ranking,
    // never the client, for the auto path.
    let targetId = requestedScenarioId;
    if (!isManual) {
      const { data: popular, error: popularErr } = await supabase.rpc("get_popular_scenarios", { limit_count: 1 });
      if (popularErr) throw popularErr;
      if (!popular || !popular.length) return json({ skipped: true, reason: "no favourites yet" });
      targetId = popular[0].scenario_id;

      const { data: existing, error: existingErr } = await supabase
        .from("popular_case_blurbs")
        .select("scenario_id")
        .eq("scenario_id", targetId)
        .maybeSingle();
      if (existingErr) throw existingErr;
      if (existing) return json({ skipped: true, reason: "already current", scenarioId: targetId });
    }

    const { data: s, error: sErr } = await supabase
      .from("scenarios")
      .select(SCENARIO_SELECT)
      .eq("id", targetId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!s) return json({ error: "Scenario not found" }, 404);

    const detail = s.subtitle || s.dispatch || s.caller_hx || "";

    // prompt_only: build and return the image brief without generating
    // anything, for the admin's review modal. Same contract as
    // generate-featured-blurb.
    if (promptOnly) {
      const { prompt: previewPrompt } = await resolveImagePrompt(s, supabase);
      return json({ ok: true, imagePrompt: previewPrompt });
    }

    // --- 1. Blurb (Anthropic) ---
    let blurb: string | null = null;
    let aiUsage: { input_tokens?: number; output_tokens?: number } | null = null;

    if (imageOnly) {
      const { data: existingBlurbRow, error: existingBlurbErr } = await supabase
        .from("popular_case_blurbs")
        .select("blurb")
        .eq("scenario_id", s.id)
        .maybeSingle();
      if (existingBlurbErr) throw existingBlurbErr;
      blurb = existingBlurbRow?.blurb || null;
    }

    if (!blurb) {
      const anthropicKey = await getAnthropicKey(supabase);
      const built = await generateBlurb(s, anthropicKey, "Most Popular Scenario", detail);
      blurb = built.blurb;
      aiUsage = built.usage;
    }

    // --- 2. Background image (Wiro) ---
    const { imageUrl, imagePrompt, briefUsage } =
      await generateAndStoreImage(supabase, s, customImagePrompt, "popular");

    // --- 3. Save --- (this table only ever holds the current #1's cached
    // content, so clear out any stale row for a different scenario first.)
    if (!isManual) {
      await supabase.from("popular_case_blurbs").delete().neq("scenario_id", s.id);
    }
    const { error: upsertErr } = await supabase
      .from("popular_case_blurbs")
      .upsert({
        scenario_id: s.id,
        blurb,
        image_url: imageUrl,
        generated_by: isManual ? userData.user.id : null,
        generated_at: new Date().toISOString()
      });
    if (upsertErr) throw upsertErr;

    await supabase.from("ai_usage_log").insert({
      source: isManual ? "admin-popular-scenario" : "auto-popular-scenario",
      model: BLURB_MODEL,
      input_tokens: (aiUsage?.input_tokens ?? 0) + (briefUsage?.input_tokens ?? 0),
      output_tokens: (aiUsage?.output_tokens ?? 0) + (briefUsage?.output_tokens ?? 0),
      label: `Popular scenario ${imageOnly ? "image regen" : "blurb"}${imageUrl ? " + image" : ""} (${isManual ? "manual" : "auto"}) — ${s.title || s.id}`
    });

    return json({ ok: true, scenarioId: s.id, blurb, imageUrl, imagePrompt });
  } catch (err) {
    console.error("generate-popular-blurb failed:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
