import React from 'react';

const RGPDContent = () => {
  return (
    <div className="prose prose-sm max-w-none">
      <p className="text-sm text-muted-foreground mb-6">
        Dernière mise à jour : 14 février 2026
      </p>

      <section className="mb-8">
        <h3 className="text-xl font-bold text-foreground mb-3">1. Données collectées</h3>
        <div className="text-muted-foreground space-y-3">
          <p>Nous collectons les données suivantes :</p>
          <p className="font-semibold">1.1 Données d'identification</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Nom, prénom, pseudonyme</li>
            <li>Adresse e-mail</li>
            <li>Numéro de téléphone</li>
            <li>Adresse postale</li>
            <li>Date de naissance</li>
            <li>Photo de profil</li>
          </ul>
          <p className="font-semibold mt-4">1.2 Données de vérification</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Pièce d'identité</li>
            <li>Justificatif de domicile</li>
            <li>Informations bancaires (via notre prestataire de paiement sécurisé)</li>
          </ul>
          <p className="font-semibold mt-4">1.3 Données d'utilisation</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Historique de navigation</li>
            <li>Annonces consultées et publiées</li>
            <li>Réservations effectuées</li>
            <li>Messages échangés</li>
            <li>Avis et évaluations</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-xl font-bold text-foreground mb-3">2. Utilisation des données</h3>
        <div className="text-muted-foreground space-y-3">
          <p>Vos données sont utilisées pour :</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Créer et gérer votre compte utilisateur</li>
            <li>Faciliter les transactions entre utilisateurs</li>
            <li>Traiter les paiements et gérer les cautions</li>
            <li>Vérifier votre identité et prévenir la fraude</li>
            <li>Vous envoyer des notifications importantes</li>
            <li>Améliorer nos services et votre expérience utilisateur</li>
            <li>Respecter nos obligations légales</li>
            <li>Résoudre les litiges et assurer la sécurité de la plateforme</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-xl font-bold text-foreground mb-3">3. Partage des données</h3>
        <div className="text-muted-foreground space-y-3">
          <p>Nous partageons vos données uniquement dans les cas suivants :</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Avec les autres utilisateurs :</strong> Votre pseudonyme, photo de profil et informations publiques sont visibles par les autres utilisateurs</li>
            <li><strong>Avec nos prestataires de services :</strong> Prestataire de paiement sécurisé, OVH (hébergement), services de courriels</li>
            <li><strong>Avec les autorités :</strong> Si requis par la loi ou pour protéger nos droits</li>
          </ul>
          <p className="mt-4">Nous ne vendons jamais vos données personnelles à des tiers.</p>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-xl font-bold text-foreground mb-3">4. Conservation des données</h3>
        <div className="text-muted-foreground space-y-3">
          <p>Nous conservons vos données :</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Compte actif :</strong> Pendant toute la durée d'utilisation de votre compte</li>
            <li><strong>Après suppression :</strong> 30 jours (sauf obligations légales)</li>
            <li><strong>Données de transaction :</strong> 10 ans (obligation comptable)</li>
            <li><strong>Données de vérification :</strong> 5 ans (obligation légale)</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-xl font-bold text-foreground mb-3">5. Vos droits</h3>
        <div className="text-muted-foreground space-y-3">
          <p>Conformément au RGPD, vous disposez des droits suivants :</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Droit d'accès :</strong> Obtenir une copie de vos données</li>
            <li><strong>Droit de rectification :</strong> Corriger vos données inexactes</li>
            <li><strong>Droit à l'effacement :</strong> Supprimer vos données (sous conditions)</li>
            <li><strong>Droit à la limitation :</strong> Limiter le traitement de vos données</li>
            <li><strong>Droit à la portabilité :</strong> Récupérer vos données dans un format structuré</li>
            <li><strong>Droit d'opposition :</strong> Vous opposer au traitement de vos données</li>
          </ul>
          <p className="mt-4">Pour exercer ces droits, contactez-nous à : <a href="mailto:dpo@lematosduvoisin.fr" className="text-[#17a2b8] hover:underline">dpo@lematosduvoisin.fr</a></p>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-xl font-bold text-foreground mb-3">6. Sécurité</h3>
        <div className="text-muted-foreground space-y-3">
          <p>Nous mettons en œuvre des mesures techniques et organisationnelles pour protéger vos données :</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Chiffrement SSL/TLS pour toutes les communications</li>
            <li>Stockage sécurisé des mots de passe (hachage bcrypt)</li>
            <li>Accès restreint aux données personnelles</li>
            <li>Sauvegardes régulières</li>
            <li>Surveillance et détection des intrusions</li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-xl font-bold text-foreground mb-3">7. Cookies</h3>
        <div className="text-muted-foreground space-y-3">
          <p>Nous utilisons des cookies pour améliorer votre expérience. Pour plus d'informations, consultez notre <a href="/legal/politique-temoins-connexion" className="text-[#17a2b8] hover:underline">Politique Cookies</a>.</p>
        </div>
      </section>

      <section className="mb-8">
        <h3 className="text-xl font-bold text-foreground mb-3">8. Contact</h3>
        <div className="text-muted-foreground space-y-3">
          <p>Pour toute question concernant cette politique de confidentialité :</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Délégué à la protection des données (DPO) :</strong> dpo@lematosduvoisin.fr</li>
            <li><strong>Courrier :</strong> Le Matos du Voisin SAS, 123 Avenue de la République, 69003 Lyon, France</li>
          </ul>
          <p className="mt-4">Vous avez également le droit de déposer une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés).</p>
        </div>
      </section>
    </div>
  );
};

export default RGPDContent;
