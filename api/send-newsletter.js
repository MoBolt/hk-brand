// /api/send-newsletter.js
// Récupère tous les abonnés actifs dans Supabase et leur envoie un email via Resend

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
    const { adminPassword, subject, htmlContent } = req.body;

    // Protection simple par mot de passe
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    if (!subject || !htmlContent) {
      return res.status(400).json({ error: 'Sujet et contenu requis' });
    }

    // Récupère tous les abonnés actifs
    const { data: subscribers, error: fetchError } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('email')
      .eq('is_active', true);

    if (fetchError) throw fetchError;

    if (!subscribers || subscribers.length === 0) {
      return res.status(200).json({ message: 'Aucun abonné trouvé', sent: 0 });
    }

    const emails = subscribers.map(s => s.email);

    // Envoie via Resend (max 50 destinataires par appel, on découpe si besoin)
    const batchSize = 50;
    let totalSent = 0;

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'HK Brand <onboarding@resend.dev>',
          to: 'delivered@resend.dev', // destinataire technique requis par Resend
          bcc: batch, // vrais destinataires en copie cachée (protège leur vie privée)
          subject: subject,
          html: htmlContent
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || 'Erreur Resend');
      }

      totalSent += batch.length;
    }

    res.status(200).json({ success: true, sent: totalSent });
  } catch (err) {
    console.error('Erreur envoi newsletter:', err);
    res.status(500).json({ error: err.message });
  }
};
