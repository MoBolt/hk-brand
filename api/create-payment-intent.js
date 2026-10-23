// /api/create-payment-intent.js
// Crée un PaymentIntent Stripe côté serveur.
// Le montant est RECALCULÉ ici à partir des prix du serveur : on ne fait jamais confiance au navigateur.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } }
);

// Prix officiels (CAD). Pour changer un prix, modifie-le ICI (et dans index.html pour l'affichage).
const PRICES = {
  'Hoodie': 45,
  'HK Short 3Cs': 60
};

// Produit de test : n'existe que si la variable Vercel ENABLE_TEST_PRODUCT vaut "true".
if (process.env.ENABLE_TEST_PRODUCT === 'true') {
  PRICES['Test'] = 0.75;
}

const SHIPPING = 10;

const PROMOS = {
  'HKLAUNCH': { type: 'percent', value: 15 },
  'HK10':     { type: 'percent', value: 10 },
  'HKVIP':    { type: 'percent', value: 20 }
};

const round2 = n => Math.round(n * 100) / 100;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, promoCode, email } = req.body || {};

    if (!Array.isArray(items) || items.length === 0 || items.length > 20) {
      return res.status(400).json({ error: 'Panier invalide' });
    }

    // 1. Sous-total calculé avec les prix du serveur
    let subtotal = 0;
    for (const item of items) {
      const price = PRICES[item && item.name];
      if (price === undefined) {
        return res.status(400).json({ error: 'Produit inconnu : ' + (item && item.name) });
      }
      subtotal += price;
    }
    subtotal = round2(subtotal);

    // 2. Code promo (valeur + usage unique par email)
    let discount = 0;
    if (promoCode) {
      const code = String(promoCode).trim().toUpperCase();
      const promo = PROMOS[code];
      if (!promo) {
        return res.status(400).json({ error: 'Code promo invalide' });
      }
      if (!email) {
        return res.status(400).json({ error: 'Email requis pour utiliser un code promo' });
      }
      const escapedEmail = String(email).trim().replace(/[\\%_]/g, '\\$&');
      const { data: used, error: usedErr } = await supabaseAdmin
        .from('promo_code_uses')
        .select('code')
        .ilike('code', code)
        .ilike('customer_email', escapedEmail)
        .limit(1);
      if (usedErr) throw usedErr;
      if (used && used.length > 0) {
        return res.status(400).json({ error: 'Ce code promo a déjà été utilisé avec cet email' });
      }
      discount = promo.type === 'percent'
        ? round2(subtotal * promo.value / 100)
        : Math.min(promo.value, subtotal);
    }

    // 3. Total final
    const total = round2(Math.max(0, subtotal - discount) + SHIPPING);

    // Stripe refuse les paiements sous 0,50 $ CAD
    if (total < 0.5) {
      return res.status(400).json({ error: 'Montant trop bas' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100), // Stripe attend des cents
      currency: 'cad',
      receipt_email: email || undefined,
      automatic_payment_methods: { enabled: true },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id,
      amount: total
    });
  } catch (err) {
    console.error('Erreur création PaymentIntent:', err);
    res.status(500).json({ error: err.message });
  }
};
