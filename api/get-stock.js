// /api/get-stock.js
// Retourne l'état du stock (tailles + couleurs) pour chaque produit, lu depuis Supabase.

const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
);

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('stock')
      .select('product, variant_type, variant_value, available');

    if (error) throw error;

    const stock = {};
    (data || []).forEach(row => {
      if (!stock[row.product]) stock[row.product] = { sizes: {}, colors: {} };
      const bucket = row.variant_type === 'size' ? 'sizes' : 'colors';
      stock[row.product][bucket][row.variant_value] = row.available;
    });

    res.status(200).json({ stock });
  } catch (err) {
    console.error('Erreur récupération stock:', err);
    res.status(500).json({ error: err.message });
  }
};
