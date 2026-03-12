/**
 * Stripe Webhook Handler
 * Handles Stripe webhook events for payment processing
 */

import { supabase } from '../lib/supabase';

/**
 * Main webhook handler
 * This should be deployed as a serverless function or API endpoint
 */
export const handleStripeWebhook = async (event) => {
  try {
    console.log('Stripe webhook received:', event?.type);

    switch (event?.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event?.data?.object);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event?.data?.object);
        break;

      case 'charge.refunded':
        await handleRefund(event?.data?.object);
        break;

      case 'setup_intent.succeeded':
        await handleDepositAuthorization(event?.data?.object);
        break;

      case 'payment_intent.canceled':
        await handlePaymentCanceled(event?.data?.object);
        break;

      case 'charge.dispute.created':
        await handleDisputeCreated(event?.data?.object);
        break;

      default:
        console.log(`Unhandled event type: ${event?.type}`);
    }

    return { received: true };
  } catch (error) {
    console.error('Webhook handler error:', error);
    throw error;
  }
};

/**
 * Handle successful payment
 */
const handlePaymentSuccess = async (paymentIntent) => {
  try {
    const reservationId = paymentIntent?.metadata?.reservation_id;
    
    if (!reservationId) {
      console.error('No reservation_id in payment metadata');
      return;
    }

    // Update reservation status
    const { error: reservationError } = await supabase?.from('reservations')?.update({
        status: 'paid',
        paid_at: new Date()?.toISOString(),
        payment_intent_id: paymentIntent?.id
      })?.eq('id', reservationId);

    if (reservationError) throw reservationError;

    // Update payment record
    const { error: paymentError } = await supabase?.from('payments')?.update({
        status: 'succeeded',
        stripe_payment_intent_id: paymentIntent?.id,
        paid_at: new Date()?.toISOString()
      })?.eq('reservation_id', reservationId)?.eq('type', 'rental_payment');

    if (paymentError) throw paymentError;

    // Create notification
    const { data: reservation } = await supabase?.from('reservations')?.select('renter_id, owner_id')?.eq('id', reservationId)?.single();

    if (reservation) {
      // Notify renter
      await supabase?.from('notifications')?.insert({
        user_id: reservation?.renter_id,
        type: 'payment_success',
        title: 'Paiement confirmé',
        message: 'Votre paiement a été traité avec succès',
        related_id: reservationId
      });

      // Notify owner
      await supabase?.from('notifications')?.insert({
        user_id: reservation?.owner_id,
        type: 'payment_received',
        title: 'Paiement reçu',
        message: 'Le locataire a effectué le paiement',
        related_id: reservationId
      });
    }

    console.log(`Payment succeeded for reservation ${reservationId}`);
  } catch (error) {
    console.error('Erreur lors du traitement de payment success:', error);
    throw error;
  }
};

/**
 * Handle failed payment
 */
const handlePaymentFailed = async (paymentIntent) => {
  try {
    const reservationId = paymentIntent?.metadata?.reservation_id;
    
    if (!reservationId) return;

    // Update reservation status
    await supabase?.from('reservations')?.update({
        status: 'payment_failed',
        payment_error: paymentIntent?.last_payment_error?.message || 'Payment failed'
      })?.eq('id', reservationId);

    // Update payment record
    await supabase?.from('payments')?.update({
        status: 'failed',
        error_message: paymentIntent?.last_payment_error?.message
      })?.eq('reservation_id', reservationId)?.eq('type', 'rental_payment');

    // Notify renter
    const { data: reservation } = await supabase?.from('reservations')?.select('renter_id')?.eq('id', reservationId)?.single();

    if (reservation) {
      await supabase?.from('notifications')?.insert({
        user_id: reservation?.renter_id,
        type: 'payment_failed',
        title: 'Échec du paiement',
        message: 'Le paiement a échoué. Veuillez réessayer.',
        related_id: reservationId
      });
    }

    console.log(`Payment failed for reservation ${reservationId}`);
  } catch (error) {
    console.error('Erreur lors du traitement de payment failure:', error);
    throw error;
  }
};

/**
 * Handle refund
 */
const handleRefund = async (charge) => {
  try {
    const paymentIntentId = charge?.payment_intent;
    
    // Find reservation by payment intent
    const { data: reservation } = await supabase?.from('reservations')?.select('id, renter_id')?.eq('payment_intent_id', paymentIntentId)?.single();

    if (!reservation) return;

    // Update reservation
    await supabase?.from('reservations')?.update({
        refund_status: 'refunded',
        refunded_at: new Date()?.toISOString(),
        refund_amount: charge?.amount_refunded / 100 // Convert cents to euros
      })?.eq('id', reservation?.id);

    // Notify renter
    await supabase?.from('notifications')?.insert({
      user_id: reservation?.renter_id,
      type: 'refund_processed',
      title: 'Remboursement effectué',
      message: 'Votre remboursement a été traité',
      related_id: reservation?.id
    });

    console.log(`Refund processed for reservation ${reservation?.id}`);
  } catch (error) {
    console.error('Erreur lors du traitement de refund:', error);
    throw error;
  }
};

/**
 * Handle deposit authorization (setup_intent)
 */
const handleDepositAuthorization = async (setupIntent) => {
  try {
    const reservationId = setupIntent?.metadata?.reservation_id;
    
    if (!reservationId) return;

    // Update reservation deposit status
    await supabase?.from('reservations')?.update({
        deposit_status: 'authorized',
        deposit_setup_intent_id: setupIntent?.id
      })?.eq('id', reservationId);

    // Update payment record
    await supabase?.from('payments')?.update({
        status: 'authorized',
        stripe_setup_intent_id: setupIntent?.id
      })?.eq('reservation_id', reservationId)?.eq('type', 'deposit_hold');

    console.log(`Deposit authorized for reservation ${reservationId}`);
  } catch (error) {
    console.error('Erreur lors du traitement de deposit authorization:', error);
    throw error;
  }
};

/**
 * Handle payment cancellation
 */
const handlePaymentCanceled = async (paymentIntent) => {
  try {
    const reservationId = paymentIntent?.metadata?.reservation_id;
    
    if (!reservationId) return;

    await supabase?.from('reservations')?.update({
        status: 'cancelled_payment',
        cancelled_at: new Date()?.toISOString()
      })?.eq('id', reservationId);

    console.log(`Payment canceled for reservation ${reservationId}`);
  } catch (error) {
    console.error('Erreur lors du traitement de payment cancellation:', error);
    throw error;
  }
};

/**
 * Handle dispute created
 */
const handleDisputeCreated = async (dispute) => {
  try {
    const chargeId = dispute?.charge;
    
    // Log dispute for admin review
    await supabase?.from('admin_logs')?.insert({
      type: 'dispute_created',
      data: {
        dispute_id: dispute?.id,
        charge_id: chargeId,
        amount: dispute?.amount / 100,
        reason: dispute?.reason,
        status: dispute?.status
      },
      created_at: new Date()?.toISOString()
    });

    console.log(`Dispute created: ${dispute?.id}`);
  } catch (error) {
    console.error('Erreur lors du traitement de dispute:', error);
    throw error;
  }
};

/**
 * Verify webhook signature (important for security)
 */
export const verifyWebhookSignature = (payload, signature, secret) => {
  // This should use Stripe's webhook signature vérification
  // Implementation depends on your backend framework
  // Example with Stripe SDK:
  // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  // const event = stripe.webhooks.constructEvent(payload, signature, secret);
  // return event;
  
  console.log('Webhook signature vérification not implemented');
  return true;
};

export default {
  handleStripeWebhook,
  verifyWebhookSignature
};

