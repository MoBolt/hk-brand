// /api/send-newsletter.js
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

    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    if (!subject || !htmlContent) {
      return res.status(400).json({ error: 'Sujet et contenu requis' });
    }

    const { data: subscribers, error: fetchError } = await supabaseAdmin
      .from('newsletter_subscribers')
      .select('email')
      .eq('is_active', true);

    if (fetchError) throw fetchError;

    if (!subscribers || subscribers.length === 0) {
      return res.status(200).json({ message: 'Aucun abonné trouvé', sent: 0 });
    }

    let sentCount = 0;
    let errors = [];

    // Envoie un email individuel à chaque abonné (plus fiable sur domaine de test)
    for (const sub of subscribers) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'HK Brand <onboarding@resend.dev>',
          to: sub.email,
          subject: subject,
          html: htmlContent
        })
      });

      if (response.ok) {
        sentCount++;
      } else {
        const errData = await response.json();
        errors.push({ email: sub.email, error: errData.message });
      }
    }

    res.status(200).json({ success: true, sent: sentCount, errors });
  } catch (err) {
    console.error('Erreur envoi newsletter:', err);
    res.status(500).json({ error: err.message });
  }
};
