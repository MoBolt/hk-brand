// /api/create-payment-intent.js
// Crée un vrai PaymentIntent Stripe côté serveur.
// Utilise ta clé SECRÈTE Stripe (jamais exposée au navigateur).

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, email } = req.body; // amount en CAD (ex: 89.99)

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe attend des cents
      currency: 'cad',
      receipt_email: email || undefined,
      automatic_payment_methods: { enabled: true },
    });

    res.status(200).json({ clientSecret: paymentIntent.client_secret, id: paymentIntent.id });
  } catch (err) {
    console.error('Erreur création PaymentIntent:', err);
    res.status(500).json({ error: err.message });
  }
};
