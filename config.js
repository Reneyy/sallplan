// Supabase Edge Function: create a teacher account with an initial password.
// Deploy with: supabase functions deploy admin-create-teacher
// Required secrets:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Nicht angemeldet." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server-Konfiguration fehlt." }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerData, error: callerError } = await userClient.auth.getUser();
    if (callerError || !callerData.user) {
      return json({ error: "Login konnte nicht geprueft werden." }, 401);
    }

    const { data: callerProfile, error: profileError } = await adminClient
      .from("teachers")
      .select("role")
      .eq("auth_user_id", callerData.user.id)
      .single();

    if (profileError || callerProfile?.role !== "admin") {
      return json({ error: "Nur Admins duerfen Lehrpersonen anlegen." }, 403);
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const roleValue = String(body.role || "subject_teacher");

    if (!name || !username || password.length < 8) {
      return json({ error: "Name, Login und ein Passwort mit mindestens 8 Zeichen sind erforderlich." }, 400);
    }

    const email = username.includes("@") ? username : `${username}@sallplan.local`;
    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, username },
    });

    if (createError || !createdUser.user) {
      return json({ error: createError?.message || "Benutzer konnte nicht erstellt werden." }, 400);
    }

    const teacherId = crypto.randomUUID();
    const { error: insertError } = await adminClient.from("teachers").insert({
      id: teacherId,
      auth_user_id: createdUser.user.id,
      name,
      username,
      role: roleValue === "admin" ? "admin" : "teacher",
      teacher_type: roleValue,
      active: true,
    });

    if (insertError) {
      await adminClient.auth.admin.deleteUser(createdUser.user.id);
      return json({ error: insertError.message }, 400);
    }

    return json({ teacherId, email, name });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unbekannter Fehler." }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
