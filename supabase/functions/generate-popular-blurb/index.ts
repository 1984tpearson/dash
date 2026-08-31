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

// Mirrors buildImagePrompt() in generate-featured-blurb.
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

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Missing auth" }, 401);
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    let isManual = false;
    let requestedScenarioId: string | null = null;
    let imageOnly = false;
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
      .select("id, title, category, subcategory, subtitle, dispatch, arrival_hx, caller_hx")
      .eq("id", targetId)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!s) return json({ error: "Scenario not found" }, 404);

    const detail = s.subtitle || s.dispatch || s.caller_hx || "";

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
            'You write a short, punchy teaser (2 sentences), shown on a homepage "Most Popular Scenario" card for clinical instructors and educators browsing the scenario library. Write it as a vivid, standalone description of the patient and what\'s happening to them — like a case summary someone would tell a colleague. Do NOT reference the assessment, the learner/student, or what needs to be figured out/managed/determined in any form — no "assess", "determine the cause", "learners must", "requires quick thinking", or similar framing. Just describe the case itself. Never address the reader as "you". Plain text only, no markdown, no quotation marks. Under 40 words total. Do not invent clinical details not implied by what is given.',
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
          headers: { "X-Dezgo-Key": dezgoKey },
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
            const path = `popular/${s.id}-${Date.now()}.png`;
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
      model: "claude-haiku-4-5-20251001",
      input_tokens: aiUsage?.input_tokens ?? 0,
      output_tokens: aiUsage?.output_tokens ?? 0,
      label: `Popular scenario ${imageOnly ? "image regen" : "blurb"}${imageUrl ? " + image" : ""} (${isManual ? "manual" : "auto"}) — ${s.title || s.id}`
    });

    return json({ ok: true, scenarioId: s.id, blurb, imageUrl });
  } catch (err) {
    console.error("generate-popular-blurb failed:", err);
    return json({ ok: false, error: String(err) }, 500);
  }
});
