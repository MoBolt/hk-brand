// /api/check-promo.js
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, email } = req.body;
    if (!code || !email) return res.status(400).json({ error: 'Code et email requis' });

    const { data, error } = await supabaseAdmin
      .from('promo_code_usage')
      .select('id')
      .eq('code', code)
      .eq('customer_email', email)
      .maybeSingle();

    if (error) throw error;

    res.status(200).json({ alreadyUsed: !!data });
  } catch (err) {
    console.error('Erreur vérification promo:', err);
    res.status(500).json({ error: err.message });
  }
};
