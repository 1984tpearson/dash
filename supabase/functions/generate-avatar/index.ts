import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PIXELLAB_API_KEY = Deno.env.get("PIXELLAB_API_KEY")!;

const ANIMALS = [
  "llama", "penguin", "koala", "fox", "otter", "hedgehog", "raccoon",
  "panda", "owl", "corgi", "capybara", "sloth", "platypus", "alpaca",
  "meerkat", "red panda", "axolotl", "wombat", "hippo", "giraffe"
];

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "Missing auth" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
  if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);
  const userId = userData.user.id;

  try {
    const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
    const description =
      `colourful comic book style close up portrait of a ${animal} EMT, ` +
      `smiling, blue uniform. colourful background`;

    const plRes = await fetch("https://api.pixellab.ai/v2/create-image-pixen", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PIXELLAB_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        description,
        image_size: { width: 64, height: 64 }
      })
    });

    if (!plRes.ok) {
      const errText = await plRes.text();
      console.error("PixelLab error:", plRes.status, errText);
      return json({ error: "Generation failed" }, 502);
    }

    const plData = await plRes.json();
    const base64 = plData?.image?.base64 || plData?.image?.data || plData?.base64;
    if (!base64) {
      console.error("Unexpected PixelLab response shape:", JSON.stringify(plData).slice(0, 500));
      return json({ error: "Unexpected response from image generator" }, 502);
    }

    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const path = `${userId}/generated-${Date.now()}.png`;

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (uploadErr) {
      console.error("Storage upload error:", uploadErr);
      return json({ error: "Failed to store avatar" }, 500);
    }

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);
    if (profileErr) {
      console.error("Profile update error:", profileErr);
      return json({ error: "Failed to save avatar" }, 500);
    }

    return json({ avatar_url: publicUrl }, 200);
  } catch (e) {
    console.error("generate-avatar error:", e);
    return json({ error: "Unexpected error" }, 500);
  }
});
