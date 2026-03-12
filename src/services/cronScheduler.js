/**
 * Planificateur cron
 * Gère l'exécution planifiée des tâches d'automatisation
 * 
 * NOTE : ceci est un planificateur côté client à des fins de démonstration.
 * En production, utilisez des tâches cron côté serveur (fonctions Edge Supabase, Vercel Cron, etc.).
 */

import automationService from './automationService';

class CronScheduler {
  constructor() {
    this.intervals = {};
    this.isRunning = false;
  }

  /**
   * Démarrer toutes les tâches planifiées
   */
  start() {
    if (this.isRunning) {
      console.warn('Le planificateur est déjà en cours');
      return;
    }

    console.log("Démarrage du planificateur d'automatisation...");
    this.isRunning = true;

    // Tache legacy (d?sactivée par le service en mode reservation instantanee)
    this.intervals.ownerCheck = setInterval(() => {
      console.log('Running (legacy no-op): check_owner_no_response');
      automationService?.checkOwnerNoResponse();
    }, 60 * 60 * 1000);

    // Contrôler la CNI post-paiement - toutes les 6 heures
    this.intervals.docsCheck = setInterval(() => {
      console.log('Running: check_missing_documents');
      automationService?.checkMissingDocuments();
    }, 6 * 60 * 60 * 1000);

    // Annuler les réservations impayées - toutes les 30 minutes
    this.intervals.cancelUnpaid = setInterval(() => {
      console.log('Running: cancel_unpaid_reservations');
      automationService?.cancelUnpaidReservations();
    }, 30 * 60 * 1000);

    // Libérer les cautions - toutes les 24 heures
    this.intervals.releaseDeposits = setInterval(() => {
      console.log('Running: release_deposits');
      automationService?.releaseDeposits();
    }, 24 * 60 * 60 * 1000);

    // Traiter les fenêtres de contestation et versements finaux - toutes les 15 minutes
    this.intervals.inspectionSettlementWindows = setInterval(() => {
      console.log('Running: process_inspection_settlement_windows');
      automationService?.processInspectionSettlementWindows();
    }, 15 * 60 * 1000);

    // Envoyer les rappels de restitution - toutes les 12 heures
    this.intervals.returnReminders = setInterval(() => {
      console.log('Running: send_return_reminders');
      automationService?.sendReturnReminders();
    }, 12 * 60 * 60 * 1000);

    // Traiter les avertissements - toutes les 24 heures
    this.intervals.processStrikes = setInterval(() => {
      console.log('Running: process_strikes');
      automationService?.processStrikes();
    }, 24 * 60 * 60 * 1000);

    // Nettoyer les blocages expirés - toutes les 24 heures
    this.intervals.cleanHolds = setInterval(() => {
      console.log('Running: clean_expired_holds');
      automationService?.cleanExpiredHolds();
    }, 24 * 60 * 60 * 1000);

    // Envoyer le récapitulatif quotidien - toutes les 24 heures à 8 h (simplifié)
    this.intervals.dailyDigest = setInterval(() => {
      console.log('Running: send_daily_digest');
      automationService?.sendDailyDigest();
    }, 24 * 60 * 60 * 1000);

    console.log('Planificateur démarré avec succès');
  }

  /**
   * Arrêter toutes les tâches planifiées
   */
  stop() {
    if (!this.isRunning) {
      console.warn("Le planificateur n'est pas en cours");
      return;
    }

    console.log("Arrêt du planificateur d'automatisation...");

    Object.keys(this.intervals)?.forEach(key => {
      clearInterval(this.intervals?.[key]);
    });

    this.intervals = {};
    this.isRunning = false;

    console.log('Planificateur arrêté');
  }

  /**
   * Obtenir l'état du planificateur
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobs: Object.keys(this.intervals)?.length
    };
  }
}

// Instance unique
const scheduler = new CronScheduler();

export default scheduler;


