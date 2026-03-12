import React, { Suspense } from "react";
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import ScrollToTop from "components/ScrollToTop";
import ErrorBoundary from "components/ErrorBoundary";
import CookieAwareAnalytics from "./components/cookies/CookieAwareAnalytics";
import NativeAppUrlHandler from "./components/NativeAppUrlHandler";
import { useAuth } from "./contexts/AuthContext";
import { isAdminAccessGranted } from "./utils/adminAccessGate";
import HomeSearch from './pages/home-search';
const NotFound = React.lazy(() => import("pages/NotFound"));
const Authentication = React.lazy(() => import('./pages/authentication'));
const AdminAccess = React.lazy(() => import('./pages/admin-access'));
const EquipmentDetail = React.lazy(() => import('./pages/equipment-detail'));
const AuthCallback = React.lazy(() => import('./pages/auth-callback'));
const ResetPassword = React.lazy(() => import('./pages/reset-password'));

const UserProfileDocuments = React.lazy(() => import('./pages/user-profile-documents'));
const BookingRequest = React.lazy(() => import('./pages/booking-request'));
const PaymentProcessing = React.lazy(() => import('./pages/payment-processing'));
const VerificationIdentiteLocation = React.lazy(() => import('./pages/verification-identite-location'));
const UserDashboard = React.lazy(() => import('./pages/user-dashboard'));
const AdminDashboard = React.lazy(() => import('./pages/admin-dashboard'));
const AdminModeration = React.lazy(() => import('./pages/admin-moderation'));
const CreateListing = React.lazy(() => import('./pages/create-listing'));
const PhotosEtatDesLieux = React.lazy(() => import('./pages/photos-d-tat-des-lieux'));
const AdminUserManagement = React.lazy(() => import('./pages/admin-user-management'));
const AdminReservationManagement = React.lazy(() => import('./pages/admin-reservation-management'));
const AdminEmailTracking = React.lazy(() => import('./pages/admin-email-tracking'));
const AdminTaskTracking = React.lazy(() => import('./pages/admin-task-tracking'));
const AdminCategories = React.lazy(() => import('./pages/admin-categories'));
const AdminEmailTemplates = React.lazy(() => import('./pages/admin-email-templates'));
const AdminFooterEditor = React.lazy(() => import('./pages/admin-footer-editor'));
const AdminLegalPages = React.lazy(() => import('./pages/admin-legal-pages'));
const AdminFAQ = React.lazy(() => import('./pages/admin-faq'));
const AdminRentalContract = React.lazy(() => import('./pages/admin-rental-contract'));
const AdminRetours = React.lazy(() => import('./pages/admin-feedbacks'));
const AdminNotifications = React.lazy(() => import('./pages/admin-notifications'));
const AdminModerateRequests = React.lazy(() => import('./pages/admin-moderate-requests'));
const AdminInspectionDisputes = React.lazy(() => import('./pages/admin-inspection-disputes'));
const AdminSignalements = React.lazy(() => import('./pages/admin-signalements'));
const NotificationsCenter = React.lazy(() => import('./pages/notifications-center'));
const MentionsLegales = React.lazy(() => import('./pages/legal/mentions-legales'));
const CGU = React.lazy(() => import('./pages/legal/cgu'));
const CGV = React.lazy(() => import('./pages/legal/cgv'));
const PolitiqueConfidentialite = React.lazy(() => import('./pages/legal/politique-confidentialite'));
const PolitiqueCookies = React.lazy(() => import('./pages/legal/politique-cookies'));
const StripeConnectOnboarding = React.lazy(() => import('./pages/stripe-connect-onboarding'));
const ReservationManagementDashboard = React.lazy(() => import('./pages/reservation-management-dashboard'));
const DocumentVerificationAdmin = React.lazy(() => import('./pages/document-verification-admin'));
const CreateDemandRequest = React.lazy(() => import('./pages/create-demand-request'));
const PublicDemandsMarketplace = React.lazy(() => import('./pages/public-demands-marketplace'));
const AdminMatching = React.lazy(() => import('./pages/admin-matching'));
const ContractGenerationPreview = React.lazy(() => import('./pages/contract-generation-preview'));
const AdminAutomationManagement = React.lazy(() => import('./pages/admin-automation-management'));
const GeolocationSearchEnhancement = React.lazy(() => import('pages/geolocation-search-enhancement'));
const UserAnnonces = React.lazy(() => import('./pages/user-annonces'));
const TesterAuthenticationContextSetup = React.lazy(() => import('./pages/tester-authentication-context-setup'));
const TestModeInterfaceWithScenarioPanel = React.lazy(() => import('./pages/test-mode-interface-with-scenario-panel'));
const AdminTestResultsDashboard = React.lazy(() => import('./pages/admin-test-results-dashboard'));
const FAQPage = React.lazy(() => import('./pages/faq'));
const InsuranceCoverage = React.lazy(() => import('./pages/insurance-coverage'));

const RouteLoadingScreen = () => (
  <div className="min-h-screen bg-[#eef6ff] flex items-center justify-center px-4">
    <div className="text-center">
      <div className="w-10 h-10 mx-auto mb-3 rounded-full border-4 border-[#0ea5b7]/20 border-t-[#0ea5b7] animate-spin" aria-hidden="true" />
      <p className="text-sm text-slate-600">Chargement de la page...</p>
    </div>
  </div>
);

const LegacyEquipmentDetailRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/detail-matériel/${id}`} replace />;
};

const LegacyBookingRequestRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/demande-reservation/${id}`} replace />;
};

const AdminGuard = ({ children }) => {
  const location = useLocation();
  const { user, userProfile, loading, profileLoading } = useAuth();
  const requestedPath = `${location?.pathname || '/administration-tableau-bord'}${location?.search || ''}`;

  if (loading || (user && profileLoading && !userProfile)) {
    return <RouteLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/authentification" replace state={{ from: requestedPath }} />;
  }

  if (userProfile?.is_admin !== true) {
    return <Navigate to="/admin" replace state={{ from: requestedPath }} />;
  }

  if (!isAdminAccessGranted()) {
    return <Navigate to="/admin" replace state={{ from: requestedPath }} />;
  }

  return children;
};

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
      <ScrollToTop />
      <NativeAppUrlHandler />
      <CookieAwareAnalytics />
      <Suspense fallback={<RouteLoadingScreen />}>
      <RouterRoutes>
        {/* Define your route here */}
        <Route path="/" element={<HomeSearch />} />
        <Route path="/authentification" element={<Authentication />} />
        <Route path="/auth/retour" element={<AuthCallback />} />
        <Route path="/reinitialiser-mot-de-passe" element={<ResetPassword />} />
        <Route path="/accueil-recherche" element={<HomeSearch />} />
        <Route path="/profil-documents-utilisateur" element={<UserProfileDocuments />} />
        <Route path="/location/:slug/:id" element={<EquipmentDetail />} />
        <Route path="/detail-matériel/:id" element={<EquipmentDetail />} />
        <Route path="/demande-reservation/:id" element={<BookingRequest />} />
        <Route path="/traitement-paiement" element={<PaymentProcessing />} />
        <Route path="/verification-identite-location" element={<VerificationIdentiteLocation />} />
        <Route path="/tableau-bord-utilisateur" element={<UserDashboard />} />
        <Route path="/mes-annonces" element={<UserAnnonces />} />
        <Route path="/mes-reservations" element={<ReservationManagementDashboard />} />
        <Route path="/administration-tableau-bord" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
        <Route path="/administration-resultats-essais" element={<AdminGuard><AdminTestResultsDashboard /></AdminGuard>} />
        <Route path="/administration-moderation" element={<AdminGuard><AdminModeration /></AdminGuard>} />
        <Route path="/administration-gestion-reservations" element={<AdminGuard><AdminReservationManagement /></AdminGuard>} />
        <Route path="/administration-gestion-utilisateurs" element={<AdminGuard><AdminUserManagement /></AdminGuard>} />
        <Route path="/administration-suivi-courriels" element={<AdminGuard><AdminEmailTracking /></AdminGuard>} />
        <Route path="/administration-suivi-taches" element={<AdminGuard><AdminTaskTracking /></AdminGuard>} />
        <Route path="/administration-categories" element={<AdminGuard><AdminCategories /></AdminGuard>} />
        <Route path="/administration-modeles-courriels" element={<AdminGuard><AdminEmailTemplates /></AdminGuard>} />
        <Route path="/administration-editeur-pied-page" element={<AdminGuard><AdminFooterEditor /></AdminGuard>} />
        <Route path="/administration-pages-legales" element={<AdminGuard><AdminLegalPages /></AdminGuard>} />
        <Route path="/administration-foire-questions" element={<AdminGuard><AdminFAQ /></AdminGuard>} />
        <Route path="/administration-contrat-location" element={<AdminGuard><AdminRentalContract /></AdminGuard>} />
        <Route path="/administration-retours" element={<AdminGuard><AdminRetours /></AdminGuard>} />
        <Route path="/administration-notifications" element={<AdminGuard><AdminNotifications /></AdminGuard>} />
        <Route path="/administration-moderation-demandes" element={<AdminGuard><AdminModerateRequests /></AdminGuard>} />
        <Route path="/administration-litiges-etat-des-lieux" element={<AdminGuard><AdminInspectionDisputes /></AdminGuard>} />
        <Route path="/administration-signalements" element={<AdminGuard><AdminSignalements /></AdminGuard>} />
        <Route path="/administration-vérification-documents" element={<AdminGuard><DocumentVerificationAdmin /></AdminGuard>} />
        <Route path="/administration-appariement" element={<AdminGuard><AdminMatching /></AdminGuard>} />
        <Route path="/apercu-generation-contrat" element={<ContractGenerationPreview />} />
        <Route path="/administration-gestion-automatisations" element={<AdminGuard><AdminAutomationManagement /></AdminGuard>} />
        <Route path="/messages" element={<Navigate to="/tableau-bord-utilisateur?tab=messages" replace />} />
        <Route path="/creer-annonce" element={<CreateListing />} />
        <Route path="/creer-demande" element={<CreateDemandRequest />} />
        <Route path="/demandes-publiques" element={<PublicDemandsMarketplace />} />
        <Route path="/photos-d-tat-des-lieux/:reservationId" element={<PhotosEtatDesLieux />} />
        <Route path="/couverture-assurance" element={<InsuranceCoverage />} />
        <Route path="/centre-notifications" element={<NotificationsCenter />} />
        <Route path="/foire-questions" element={<FAQPage />} />
        <Route path="/legal/mentions-legales" element={<MentionsLegales />} />
        <Route path="/legal/cgu" element={<CGU />} />
        <Route path="/legal/cgv" element={<CGV />} />
        <Route path="/legal/politique-confidentialite" element={<PolitiqueConfidentialite />} />
        <Route path="/legal/politique-temoins-connexion" element={<PolitiqueCookies />} />
        <Route path="/legal/connexion-stripe" element={<StripeConnectOnboarding />} />
        <Route path="/tableau-gestion-reservations" element={<Navigate to="/mes-reservations" replace />} />
        <Route path="/parametres" element={<Navigate to="/tableau-bord-utilisateur" replace />} />
        <Route path="/amelioration-recherche-geolocalisee" element={<GeolocationSearchEnhancement />} />
        <Route path="/participant-configuration-contexte-authentification" element={<TesterAuthenticationContextSetup />} />
        <Route path="/interface-mode-essai-panneau-scenario" element={<TestModeInterfaceWithScenarioPanel />} />

        <Route path="/authentication" element={<Navigate to="/authentification" replace />} />
        <Route path="/auth/callback" element={<Navigate to="/auth/retour" replace />} />
        <Route path="/reset-password" element={<Navigate to="/reinitialiser-mot-de-passe" replace />} />
        <Route path="/home-search" element={<Navigate to="/accueil-recherche" replace />} />
        <Route path="/user-profile-documents" element={<Navigate to="/profil-documents-utilisateur" replace />} />
        <Route path="/equipment-detail/:id" element={<LegacyEquipmentDetailRedirect />} />
        <Route path="/booking-request/:id" element={<LegacyBookingRequestRedirect />} />
        <Route path="/payment-processing" element={<Navigate to="/traitement-paiement" replace />} />
        <Route path="/identity-vérification" element={<Navigate to="/verification-identite-location" replace />} />
        <Route path="/user-dashboard" element={<Navigate to="/tableau-bord-utilisateur" replace />} />
        <Route path="/admin" element={<AdminAccess />} />
        <Route path="/admin-dashboard" element={<Navigate to="/administration-tableau-bord" replace />} />
        <Route path="/admin-test-results-dashboard" element={<Navigate to="/administration-resultats-essais" replace />} />
        <Route path="/admin-moderation" element={<Navigate to="/administration-moderation" replace />} />
        <Route path="/admin-reservation-management" element={<Navigate to="/administration-gestion-reservations" replace />} />
        <Route path="/admin-user-management" element={<Navigate to="/administration-gestion-utilisateurs" replace />} />
        <Route path="/admin-email-tracking" element={<Navigate to="/administration-suivi-courriels" replace />} />
        <Route path="/admin-task-tracking" element={<Navigate to="/administration-suivi-taches" replace />} />
        <Route path="/admin-categories" element={<Navigate to="/administration-categories" replace />} />
        <Route path="/admin-email-templates" element={<Navigate to="/administration-modeles-courriels" replace />} />
        <Route path="/admin-footer-editor" element={<Navigate to="/administration-editeur-pied-page" replace />} />
        <Route path="/admin-legal-pages" element={<Navigate to="/administration-pages-legales" replace />} />
        <Route path="/admin-faq" element={<Navigate to="/administration-foire-questions" replace />} />
        <Route path="/admin-rental-contract" element={<Navigate to="/administration-contrat-location" replace />} />
        <Route path="/admin-feedbacks" element={<Navigate to="/administration-retours" replace />} />
        <Route path="/admin-notifications" element={<Navigate to="/administration-notifications" replace />} />
        <Route path="/admin-moderate-requests" element={<Navigate to="/administration-moderation-demandes" replace />} />
        <Route path="/admin-inspection-disputes" element={<Navigate to="/administration-litiges-etat-des-lieux" replace />} />
        <Route path="/admin-signalements" element={<Navigate to="/administration-signalements" replace />} />
        <Route path="/admin-document-vérification" element={<Navigate to="/administration-vérification-documents" replace />} />
        <Route path="/admin-matching" element={<Navigate to="/administration-appariement" replace />} />
        <Route path="/contract-generation-preview" element={<Navigate to="/apercu-generation-contrat" replace />} />
        <Route path="/admin-automation-management" element={<Navigate to="/administration-gestion-automatisations" replace />} />
        <Route path="/create-listing" element={<Navigate to="/creer-annonce" replace />} />
        <Route path="/create-demand-request" element={<Navigate to="/creer-demande" replace />} />
        <Route path="/public-demands-marketplace" element={<Navigate to="/demandes-publiques" replace />} />
        <Route path="/insurance-coverage" element={<Navigate to="/couverture-assurance" replace />} />
        <Route path="/notifications-center" element={<Navigate to="/centre-notifications" replace />} />
        <Route path="/notifications" element={<Navigate to="/centre-notifications" replace />} />
        <Route path="/faq" element={<Navigate to="/foire-questions" replace />} />
        <Route path="/settings" element={<Navigate to="/parametres" replace />} />
        <Route path="/stripe-connect-onboarding" element={<Navigate to="/legal/connexion-stripe" replace />} />
        <Route path="/mentions-legales" element={<Navigate to="/legal/mentions-legales" replace />} />
        <Route path="/cgu" element={<Navigate to="/legal/cgu" replace />} />
        <Route path="/cgv" element={<Navigate to="/legal/cgv" replace />} />
        <Route path="/politique-confidentialite" element={<Navigate to="/legal/politique-confidentialite" replace />} />
        <Route path="/politique-cookies" element={<Navigate to="/legal/politique-temoins-connexion" replace />} />
        <Route path="/legal/politique-cookies" element={<Navigate to="/legal/politique-temoins-connexion" replace />} />
        <Route path="/legal/integration-stripe-connect" element={<Navigate to="/legal/connexion-stripe" replace />} />
        <Route path="/legal/stripe-connect-onboarding" element={<Navigate to="/legal/connexion-stripe" replace />} />
        <Route path="/reservation-management-dashboard" element={<Navigate to="/mes-reservations" replace />} />
        <Route path="/geolocation-search-enhancement" element={<Navigate to="/amelioration-recherche-geolocalisee" replace />} />
        <Route path="/tester-authentication-context-setup" element={<Navigate to="/participant-configuration-contexte-authentification" replace />} />
        <Route path="/test-mode-interface-with-scenario-panel" element={<Navigate to="/interface-mode-essai-panneau-scenario" replace />} />
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;


