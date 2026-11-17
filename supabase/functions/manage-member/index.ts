// Supabase Edge Function: manage-member
// Deploy with: supabase functions deploy manage-member
// Secrets required (auto-injected by Supabase): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ManageMemberPayload {
  action: "create" | "toggle_active" | "reset_password" | "delete";
  user_id?: string;
  name?: string;
  username?: string;
  password?: string;
  committee_id?: string;
  is_active?: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing Supabase environment variables." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Verify caller identity using caller's JWT
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerUser, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !callerUser?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Initialize privileged admin client using service_role (server-side only)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 3. Enforce Principal (admin) role check
    const { data: callerProfile, error: profileErr } = await adminClient
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", callerUser.user.id)
      .single();

    if (profileErr || !callerProfile || callerProfile.role !== "admin" || !callerProfile.is_active) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Only the active Principal (Admin) can manage committee accounts." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: ManageMemberPayload = await req.json();

    if (payload.action === "create") {
      const name = (payload.name ?? "").trim();
      const username = (payload.username ?? "").trim().toLowerCase();
      const password = payload.password ?? "";
      const committeeId = (payload.committee_id ?? "").trim();

      if (!name || !username || !password || !committeeId) {
        return new Response(
          JSON.stringify({ error: "Name, username, password, and committee are required." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!/^[a-z0-9_]{3,32}$/.test(username)) {
        return new Response(
          JSON.stringify({ error: "Username must be 3-32 lowercase letters, numbers, or underscores (e.g. nss_priya)." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (password.length < 8) {
        return new Response(
          JSON.stringify({ error: "Temporary password must be at least 8 characters." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check committee exists
      const { data: committee } = await adminClient
        .from("committees")
        .select("id")
        .eq("id", committeeId)
        .single();

      if (!committee) {
        return new Response(
          JSON.stringify({ error: "Invalid committee_id." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check unique username
      const { data: existing } = await adminClient
        .from("profiles")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ error: `Username "${username}" is already taken.` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const internalEmail = `${username}@jmpatel.app`;
      const { data: createdAuth, error: createErr } = await adminClient.auth.admin.createUser({
        email: internalEmail,
        password,
        email_confirm: true,
        user_metadata: { name, username, role: "committee_member", committee_id: committeeId },
      });

      if (createErr || !createdAuth.user) {
        return new Response(
          JSON.stringify({ error: createErr?.message ?? "Failed to create Auth user." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: insertedProfile, error: insertErr } = await adminClient
        .from("profiles")
        .insert({
          id: createdAuth.user.id,
          name,
          username,
          email: null, // Never expose internal email to frontend
          role: "committee_member",
          committee_id: committeeId,
          is_active: true,
          must_change_password: true,
        })
        .select()
        .single();

      if (insertErr) {
        await adminClient.auth.admin.deleteUser(createdAuth.user.id);
        return new Response(
          JSON.stringify({ error: insertErr.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ member: insertedProfile }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Actions requiring target user_id
    const targetUserId = payload.user_id;
    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "user_id is required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targetUserId === callerProfile.id) {
      return new Response(
        JSON.stringify({ error: "Principal admin account cannot be modified or deleted through this action." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", targetUserId)
      .single();

    if (!targetProfile || targetProfile.role !== "committee_member") {
      return new Response(
        JSON.stringify({ error: "Target user is not a committee member." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (payload.action === "toggle_active") {
      const nextActive = Boolean(payload.is_active);
      const { data: updated, error: updErr } = await adminClient
        .from("profiles")
        .update({ is_active: nextActive })
        .eq("id", targetUserId)
        .select()
        .single();

      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Ban/unban in Supabase Auth so disabled accounts cannot refresh JWTs
      await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: nextActive ? "none" : "876000h",
      });

      return new Response(JSON.stringify({ member: updated }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.action === "reset_password") {
      const newPassword = payload.password ?? "";
      if (newPassword.length < 8) {
        return new Response(
          JSON.stringify({ error: "New temporary password must be at least 8 characters." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: authErr } = await adminClient.auth.admin.updateUserById(targetUserId, {
        password: newPassword,
      });

      if (authErr) {
        return new Response(JSON.stringify({ error: authErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: updated, error: profErr } = await adminClient
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", targetUserId)
        .select()
        .single();

      if (profErr) {
        return new Response(JSON.stringify({ error: profErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ member: updated }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.action === "delete") {
      const { error: delErr } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (delErr) {
        return new Response(JSON.stringify({ error: delErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ deleted: true, user_id: targetUserId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported action." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
