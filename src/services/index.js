// Central export for all Supabase services

import authService from './authService';
import profileService from './profileService';
import annonceService from './annonceService';
import reservationService from './reservationService';
import messageService from './messageService';
import bookingService from './bookingService';
import paymentService from './paymentService';
import notificationService from './notificationService';
import categoryService from './categoryService';
import legalService from './legalService';
import documentService from './documentService';
import photoService from './photoService';
import feedbackService from './feedbackService';
import sanctionService from './sanctionService';
import faqService from './faqService';
import demandeService from './demandeService';
import matchingService from './matchingService';
import contractService from './contractService';
import automationService from './automationService';
import storageService from './storageService';
import emailService from './emailService';
import inspectionService from './inspectionService';

import geolocationService from './geolocationService';

import userTestingService from './userTestingService';

export default {
  auth: authService,
  profile: profileService,
  annonce: annonceService,
  category: categoryService,
  booking: bookingService,
  reservation: reservationService,
  message: messageService,
  notification: notificationService,
  payment: paymentService,
  storage: storageService,
  photo: photoService,
  document: documentService,
  contract: contractService,
  feedback: feedbackService,
  faq: faqService,
  legal: legalService,
  sanction: sanctionService,
  demande: demandeService,
  matching: matchingService,
  automation: automationService,
  inspection: inspectionService,
  geolocation: geolocationService,
  email: emailService,
  userTesting: userTestingService
};

// Legacy supabaseService for backward compatibility
export { default as supabaseService } from './supabaseService';
export { default as testingService } from './testingService';
