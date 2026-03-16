import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const { data: isAdminData } = await callerClient.rpc('is_admin');
    if (!isAdminData) return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), { status: 403, headers: corsHeaders });

    const { action, userId, name, email, password } = await req.json();

    // LIST all admins
    if (action === 'list') {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, user_id, name, role, created_at')
        .eq('role', 'admin')
        .order('created_at', { ascending: true });

      if (profilesError) return new Response(JSON.stringify({ error: profilesError.message }), { status: 500, headers: corsHeaders });

      // Fetch emails from auth.users for each admin
      const admins = await Promise.all(
        (profiles ?? []).map(async (p) => {
          const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
          return {
            ...p,
            email: userError ? '' : (user?.email ?? ''),
          };
        })
      );

      return new Response(JSON.stringify({ admins }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // UPDATE admin (name, email, password)
    if (action === 'update') {
      if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: corsHeaders });

      // Update profile name
      if (name) {
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ name })
          .eq('user_id', userId);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      }

      // Update email / password in auth.users
      const authUpdate: Record<string, string> = {};
      if (email) authUpdate.email = email;
      if (password) authUpdate.password = password;

      if (Object.keys(authUpdate).length > 0) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // DELETE admin
    if (action === 'delete') {
      if (!userId) return new Response(JSON.stringify({ error: 'userId required' }), { status: 400, headers: corsHeaders });

      // Safety: can't delete self
      if (userId === caller.id) {
        return new Response(JSON.stringify({ error: 'Você não pode excluir sua própria conta.' }), { status: 400, headers: corsHeaders });
      }

      // Safety: must have at least 2 admins
      const { count } = await supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin');

      if ((count ?? 0) <= 1) {
        return new Response(JSON.stringify({ error: 'O sistema deve ter pelo menos um administrador.' }), { status: 400, headers: corsHeaders });
      }

      // Delete user from auth (cascades to profiles/user_roles via triggers/FK)
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
