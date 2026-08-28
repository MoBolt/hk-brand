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

    // Envoie l'email de confirmation au client (ne bloque pas la commande si ça échoue)
    try {
      const itemsList = Array.isArray(items)
        ? items.map(i => `<li>${i.name || 'Article'} ${i.size ? '— ' + i.size : ''} x${i.quantity || 1}</li>`).join('')
        : '';

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'HK Brand <onboarding@resend.dev>',
          to: customerEmail,
          subject: `Confirmation de ta commande — HK Brand`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
              <h1 style="font-size: 1.5rem;">Merci pour ta commande, ${customerName} !</h1>
              <p>On a bien reçu ton paiement. Voici un résumé :</p>
              <ul>${itemsList}</ul>
              <p><strong>Sous-total :</strong> ${subtotal} CAD<br>
              <strong>Livraison :</strong> ${shippingCost} CAD<br>
              <strong>Taxes :</strong> ${taxAmount} CAD<br>
              <strong>Total :</strong> ${total} CAD</p>
              <p><strong>Adresse de livraison :</strong><br>${shippingAddress}</p>
              <p style="margin-top: 30px; font-style: italic;">Calm. Conscious. Connected.</p>
              <p>— L'équipe HK Brand</p>
            </div>
          `
        })
      });
    } catch (emailErr) {
      console.error('Erreur envoi email confirmation (non bloquant):', emailErr);
    }

    res.status(200).json({ success: true, order: data });
  } catch (err) {
    console.error('Erreur confirmation commande:', err);
    res.status(500).json({ error: err.message });
  }
};
