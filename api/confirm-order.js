// /api/confirm-order.js
// Vérifie que le paiement Stripe est réellement réussi, PUIS enregistre la commande dans Supabase.
// Ne fait jamais confiance à ce que le navigateur dit — on revérifie le statut directement auprès de Stripe.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
    const {
      paymentIntentId,
      customerEmail,
      customerName,
      shippingAddress,
      items,
      subtotal,
      shippingCost,
      taxAmount,
      total,
      promoCode,
      province
    } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId requis' });
    }

    // Vérification critique : on confirme auprès de Stripe que le paiement est vraiment passé
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Paiement non confirmé', status: paymentIntent.status });
    }

    const { data, error } = await supabaseAdmin
      .from('orders')
      .insert({
        stripe_payment_id: paymentIntentId,
        customer_email: customerEmail,
        customer_name: customerName,
        shipping_address: shippingAddress,
        items,
        subtotal,
        shipping_cost: shippingCost,
        tax_amount: taxAmount,
        total,
        promo_code: promoCode || null,
        province
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(200).json({ message: 'Commande déjà enregistrée' });
      }
      throw error;
    }

    if (promoCode) {
      await supabaseAdmin.from('promo_code_uses').insert({
        code: promoCode,
        customer_email: customerEmail,
        order_id: data.id
      });
    }

    res.status(200).json({ success: true, order: data });
  } catch (err) {
    console.error('Erreur confirmation commande:', err);
    res.status(500).json({ error: err.message });
  }
};
