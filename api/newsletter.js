// /api/newsletter.js
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
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis' });

    const { error } = await supabaseAdmin
      .from('newsletter_subscribers')
      .insert({ email });

    if (error) {
      if (error.code === '23505') {
        return res.status(200).json({ message: 'Déjà inscrit!' });
      }
      throw error;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Erreur newsletter:', err);
    res.status(500).json({ error: err.message });
  }
};
