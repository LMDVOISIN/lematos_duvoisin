import React, { Suspense } from "react";
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";
import ErrorBoundary from "./components/ErrorBoundary";
import CookieAwareAnalytics from "./components/cookies/CookieAwareAnalytics";
import SiteChatbot from "./components/chatbot/SiteChatbot";
import NativeAppUrlHandler from "./components/NativeAppUrlHandler";
import TestModeLayout from "./components/TestModeLayout";
import RouteVerificationMarker from "./components/verification/RouteVerificationMarker";
import { useAuth } from "./contexts/AuthContext";
import { isAdminAccessGranted } from "./utils/adminAccessGate";
import { isNativeIOSApp } from "./utils/nativeRuntime";
import {
  ACCOUNT_SECTION_PATHS,
  resolveLegacyAccountTabPath
} from './pages/user-profile-documents/accountNavigation';
import HomeSearch from './pages/home-search';
import PublicDemandDetail from './pages/public-demand-detail';
const NotFound = React.lazy(() => import("./pages/NotFound"));
const Authentication = React.lazy(() => import('./pages/authentication'));
const AdminAccess = React.lazy(() => import('./pages/admin-access'));
const EquipmentDetail = React.lazy(() => import('./pages/equipment-detail'));
const AuthCallback = React.lazy(() => import('./pages/auth-callback'));
const ResetPassword = React.lazy(() => import('./pages/reset-password'));

const UserProfileDocuments = React.lazy(() => import('./pages/user-profile-documents'));
const BookingRequest = React.lazy(() => import('./pages/booking-request'));
const PaymentProcessing = React.lazy(() => import('./pages/payment-processing'));
const VerificationIdentiteLocation = React.lazy(() => import('./pages/verification-identite-location'));
const Messages = React.lazy(() => import('./pages/messages'));
const UserDemandes = React.lazy(() => import('./pages/user-demandes'));
const AdminDashboard = React.lazy(() => import('./pages/admin-dashboard'));
const AdminModeration = React.lazy(() => import('./pages/admin-moderation'));
const CreateListing = React.lazy(() => import('./pages/create-listing'));
const PhotosEtatDesLieux = React.lazy(() => import('./pages/photos-d-tat-des-lieux'));
const AdminUserManagement = React.lazy(() => import('./pages/admin-user-management'));
const AdminReservationManagement = React.lazy(() => import('./pages/admin-reservation-management'));
const AdminEmailTracking = React.lazy(() => import('./pages/admin-email-tracking'));
const AdminTaskTracking = React.lazy(() => import('./pages/admin-task-tracking'));
const AdminCategories = React.lazy(() => import('./pages/admin-categories'));
const AdminObjectImageLibrary = React.lazy(() => import('./pages/admin-object-image-library'));
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
const SupportPage = React.lazy(() => import('./pages/support'));
const ReservationManagementDashboard = React.lazy(() => import('./pages/reservation-management-dashboard'));
const DocumentVerificationAdmin = React.lazy(() => import('./pages/document-verification-admin'));
const CreateDemandRequest = React.lazy(() => import('./pages/create-demand-request'));
const PublicDemandsMarketplace = React.lazy(() => import('./pages/public-demands-marketplace'));
const AdminMatching = React.lazy(() => import('./pages/admin-matching'));
const ContractGenerationPreview = React.lazy(() => import('./pages/contract-generation-preview'));
const AdminAutomationManagement = React.lazy(() => import('./pages/admin-automation-management'));
const GeolocationSearchEnhancement = React.lazy(() => import('./pages/geolocation-search-enhancement'));
const UserAnnonces = React.lazy(() => import('./pages/user-annonces'));
const TesterAuthenticationContextSetup = React.lazy(() => import('./pages/tester-authentication-context-setup'));
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

const AdminReleaseFallback = () => (
  <Navigate to="/administration-tableau-bord" replace />
);

const LegacyEquipmentDetailRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/detail-matériel/${id}`} replace />;
};

const LegacyBookingRequestRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/demande-reservation/${id}`} replace />;
};

const buildRedirectPath = (pathname, keys = [], sourceParams = new URLSearchParams()) => {
  const nextParams = new URLSearchParams();

  keys?.forEach((key) => {
    const value = sourceParams?.get(key);
    if (value) {
      nextParams?.set(key, value);
    }
  });

  const queryString = nextParams?.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
};

const LegacyUserDashboardRedirect = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location?.search || '');
  const requestedTab = String(searchParams?.get('tab') || '')?.trim()?.toLowerCase();
  const requestedAccountPath = resolveLegacyAccountTabPath(requestedTab);

  if (requestedTab === 'listings') {
    return <Navigate to="/mes-annonces" replace />;
  }

  if (requestedTab === 'demandes') {
    return <Navigate to="/mes-annonces#demandes" replace />;
  }

  if (requestedTab === 'messages') {
    return <Navigate to={buildRedirectPath('/messages', ['conversation'], searchParams)} replace />;
  }

  if (requestedAccountPath) {
    const nextParams = new URLSearchParams(searchParams);

    nextParams.delete('tab');
    if (requestedAccountPath !== ACCOUNT_SECTION_PATHS.payouts) {
      nextParams.delete('activation');
    }

    const nextSearch = nextParams?.toString();

    return (
      <Navigate
        to={{
          pathname: requestedAccountPath,
          search: nextSearch ? `?${nextSearch}` : ''
        }}
        replace
      />
    );
  }

  return (
    <Navigate
      to={buildRedirectPath('/mes-reservations', ['conversation', 'annonce', 'other'], searchParams)}
      replace
    />
  );
};

const LegacyPayoutSettingsRedirect = () => {
  const location = useLocation();
  const nextParams = new URLSearchParams(location?.search || '');
  nextParams.delete('tab');
  const nextSearch = nextParams?.toString();

  return (
    <Navigate
      to={{
        pathname: ACCOUNT_SECTION_PATHS.payouts,
        search: nextSearch ? `?${nextSearch}` : ''
      }}
      replace
    />
  );
};

const AdminGuard = ({ children }) => {
  const location = useLocation();
  const { user, userProfile, loading, profileLoading } = useAuth();
  const requestedPath = `${location?.pathname || '/administration-tableau-bord'}${location?.search || ''}`;

  if (loading || (user && profileLoading && !userProfile)) {
    return <RouteLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/admin" replace state={{ from: requestedPath }} />;
  }

  if (userProfile?.is_admin !== true) {
    return <Navigate to="/admin" replace state={{ from: requestedPath }} />;
  }

  if (!isAdminAccessGranted()) {
    return <Navigate to="/admin" replace state={{ from: requestedPath }} />;
  }

  return children;
};

const withTestMode = (element) => (
  <TestModeLayout>
    {element}
  </TestModeLayout>
);

const withRouteVerification = (routeId, element) => (
  <RouteVerificationMarker routeId={routeId}>
    {element}
  </RouteVerificationMarker>
);

const AUTH_ROUTE_PREFIXES = ['/authentification', '/auth/retour', '/reinitialiser-mot-de-passe'];

const AppRouterContent = () => {
  const location = useLocation();
  const shouldRenderCookieAwareAnalytics = !isNativeIOSApp();
  const currentPath = String(location?.pathname || '')?.trim()?.toLowerCase();
  const isAuthRelatedRoute = AUTH_ROUTE_PREFIXES.some((prefix) => currentPath.startsWith(prefix));
  const shouldRenderSiteChatbot = !isNativeIOSApp() && !isAuthRelatedRoute;

  return (
    <ErrorBoundary>
      <ScrollToTop />
      <NativeAppUrlHandler />
      {shouldRenderCookieAwareAnalytics ? <CookieAwareAnalytics /> : null}
      {shouldRenderSiteChatbot ? <SiteChatbot /> : null}
      <Suspense fallback={<RouteLoadingScreen />}>
      <RouterRoutes>
        {/* Define your route here */}
        <Route path="/" element={withRouteVerification("home-search", withTestMode(<HomeSearch />))} />
        <Route path="/authentification" element={withRouteVerification("authentication", <Authentication />)} />
        <Route path="/auth/retour" element={withRouteVerification("auth-callback", <AuthCallback />)} />
        <Route path="/reinitialiser-mot-de-passe" element={withRouteVerification("reset-password", <ResetPassword />)} />
        <Route path="/accueil-recherche" element={withRouteVerification("home-search", withTestMode(<HomeSearch />))} />
        <Route path={ACCOUNT_SECTION_PATHS.profile} element={withRouteVerification("account-profile", withTestMode(<UserProfileDocuments section="profile" />))} />
        <Route path={ACCOUNT_SECTION_PATHS.activity} element={withRouteVerification("account-activity", withTestMode(<UserProfileDocuments section="activity" />))} />
        <Route path={ACCOUNT_SECTION_PATHS.documents} element={withRouteVerification("account-documents", withTestMode(<UserProfileDocuments section="documents" />))} />
        <Route path={ACCOUNT_SECTION_PATHS.settings} element={withRouteVerification("account-settings", withTestMode(<UserProfileDocuments section="settings" />))} />
        <Route path={ACCOUNT_SECTION_PATHS.payouts} element={withRouteVerification("account-payouts", withTestMode(<UserProfileDocuments section="payouts" />))} />
        <Route path={ACCOUNT_SECTION_PATHS.logout} element={withRouteVerification("account-logout", withTestMode(<UserProfileDocuments section="logout" />))} />
        <Route path={ACCOUNT_SECTION_PATHS.report} element={withRouteVerification("account-report", withTestMode(<UserProfileDocuments section="report" />))} />
        <Route path="/location/:slug/:id" element={withRouteVerification("equipment-detail", withTestMode(<EquipmentDetail />))} />
        <Route path="/detail-matériel/:id" element={withRouteVerification("equipment-detail", withTestMode(<EquipmentDetail />))} />
        <Route path="/demande-reservation/:id" element={withRouteVerification("booking-request", withTestMode(<BookingRequest />))} />
        <Route path="/traitement-paiement" element={withRouteVerification("payment-processing", withTestMode(<PaymentProcessing />))} />
        <Route path="/verification-identite-location" element={withRouteVerification("identity-verification-rental", withTestMode(<VerificationIdentiteLocation />))} />
        <Route path="/tableau-bord-utilisateur" element={<LegacyUserDashboardRedirect />} />
        <Route path="/mes-annonces" element={withRouteVerification("user-listings", withTestMode(<UserAnnonces />))} />
        <Route path="/mes-demandes" element={withRouteVerification("user-demands", withTestMode(<UserDemandes />))} />
        <Route path="/mes-reservations" element={withRouteVerification("reservation-management", withTestMode(<ReservationManagementDashboard />))} />
        <Route path="/administration-tableau-bord" element={withRouteVerification("admin-dashboard", <AdminGuard><AdminDashboard /></AdminGuard>)} />
        <Route path="/administration-cahier-des-charges-plateforme" element={withRouteVerification("admin-platform-spec", <AdminGuard><AdminReleaseFallback /></AdminGuard>)} />
        <Route path="/administration-resultats-essais" element={withRouteVerification("admin-test-results", <AdminGuard><AdminTestResultsDashboard /></AdminGuard>)} />
        <Route path="/administration-moderation" element={withRouteVerification("admin-moderation", <AdminGuard><AdminModeration /></AdminGuard>)} />
        <Route path="/administration-gestion-reservations" element={withRouteVerification("admin-reservation-management", <AdminGuard><AdminReservationManagement /></AdminGuard>)} />
        <Route path="/administration-gestion-utilisateurs" element={withRouteVerification("admin-user-management", <AdminGuard><AdminUserManagement /></AdminGuard>)} />
        <Route path="/administration-suivi-courriels" element={withRouteVerification("admin-email-tracking", <AdminGuard><AdminEmailTracking /></AdminGuard>)} />
        <Route path="/administration-scan-securite" element={withRouteVerification("admin-security-scan", <AdminGuard><AdminReleaseFallback /></AdminGuard>)} />
        <Route path="/administration-suivi-taches" element={withRouteVerification("admin-task-tracking", <AdminGuard><AdminTaskTracking /></AdminGuard>)} />
        <Route path="/administration-categories" element={withRouteVerification("admin-categories", <AdminGuard><AdminCategories /></AdminGuard>)} />
        <Route path="/administration-bibliotheque-images-demandes" element={withRouteVerification("admin-object-image-library", <AdminGuard><AdminObjectImageLibrary /></AdminGuard>)} />
        <Route path="/administration-modeles-courriels" element={withRouteVerification("admin-email-templates", <AdminGuard><AdminEmailTemplates /></AdminGuard>)} />
        <Route path="/administration-editeur-pied-page" element={withRouteVerification("admin-footer-editor", <AdminGuard><AdminFooterEditor /></AdminGuard>)} />
        <Route path="/administration-pages-legales" element={withRouteVerification("admin-legal-pages", <AdminGuard><AdminLegalPages /></AdminGuard>)} />
        <Route path="/administration-foire-questions" element={withRouteVerification("admin-faq", <AdminGuard><AdminFAQ /></AdminGuard>)} />
        <Route path="/administration-contrat-location" element={withRouteVerification("admin-rental-contract", <AdminGuard><AdminRentalContract /></AdminGuard>)} />
        <Route path="/administration-retours" element={withRouteVerification("admin-feedbacks", <AdminGuard><AdminRetours /></AdminGuard>)} />
        <Route path="/administration-notifications" element={withRouteVerification("admin-notifications", <AdminGuard><AdminNotifications /></AdminGuard>)} />
        <Route path="/administration-audit-references" element={withRouteVerification("admin-reference-audit", <AdminGuard><AdminReleaseFallback /></AdminGuard>)} />
        <Route path="/administration-moderation-demandes" element={withRouteVerification("admin-moderate-requests", <AdminGuard><AdminModerateRequests /></AdminGuard>)} />
        <Route path="/administration-litiges-etat-des-lieux" element={withRouteVerification("admin-inspection-disputes", <AdminGuard><AdminInspectionDisputes /></AdminGuard>)} />
        <Route path="/administration-signalements" element={withRouteVerification("admin-signalements", <AdminGuard><AdminSignalements /></AdminGuard>)} />
        <Route path="/administration-vérification-documents" element={withRouteVerification("admin-document-verification", <AdminGuard><DocumentVerificationAdmin /></AdminGuard>)} />
        <Route path="/administration-verification-documents" element={withRouteVerification("admin-document-verification", <AdminGuard><DocumentVerificationAdmin /></AdminGuard>)} />
        <Route path="/administration-appariement" element={withRouteVerification("admin-matching", <AdminGuard><AdminMatching /></AdminGuard>)} />
        <Route path="/apercu-generation-contrat" element={withRouteVerification("contract-generation-preview", <ContractGenerationPreview />)} />
        <Route path="/administration-gestion-automatisations" element={withRouteVerification("admin-automation-management", <AdminGuard><AdminAutomationManagement /></AdminGuard>)} />
        <Route path="/messages" element={withRouteVerification("messages", withTestMode(<Messages />))} />
        <Route path="/creer-annonce" element={withRouteVerification("create-listing", withTestMode(<CreateListing />))} />
        <Route path="/creer-demande" element={withRouteVerification("create-demand-request", withTestMode(<CreateDemandRequest />))} />
        <Route path="/demandes-publiques" element={withRouteVerification("public-demands-marketplace", withTestMode(<PublicDemandsMarketplace />))} />
        <Route path="/demandes-publiques/:slug/:id" element={withRouteVerification("public-demand-detail", withTestMode(<PublicDemandDetail />))} />
        <Route path="/photos-d-tat-des-lieux/:reservationId" element={withRouteVerification("photos-inspection", withTestMode(<PhotosEtatDesLieux />))} />
        <Route path="/couverture-assurance" element={withRouteVerification("insurance-coverage", withTestMode(<InsuranceCoverage />))} />
        <Route path="/centre-notifications" element={withRouteVerification("notifications-center", withTestMode(<NotificationsCenter />))} />
        <Route path="/foire-questions" element={withRouteVerification("faq", withTestMode(<FAQPage />))} />
        <Route path="/support" element={withRouteVerification("support", <SupportPage />)} />
        <Route path="/legal/mentions-legales" element={withRouteVerification("legal-mentions", <MentionsLegales />)} />
        <Route path="/legal/cgu" element={withRouteVerification("legal-cgu", <CGU />)} />
        <Route path="/legal/cgv" element={withRouteVerification("legal-cgv", <CGV />)} />
        <Route path="/legal/politique-confidentialite" element={withRouteVerification("legal-privacy", <PolitiqueConfidentialite />)} />
        <Route path="/legal/politique-temoins-connexion" element={withRouteVerification("legal-cookies", <PolitiqueCookies />)} />
        <Route path="/coordonnees-versement" element={<LegacyPayoutSettingsRedirect />} />
        <Route path="/tableau-gestion-reservations" element={<Navigate to="/mes-reservations" replace />} />
        <Route path="/parametres" element={<Navigate to={ACCOUNT_SECTION_PATHS.settings} replace />} />
        <Route path="/amelioration-recherche-geolocalisee" element={withRouteVerification("geolocation-search", withTestMode(<GeolocationSearchEnhancement />))} />
        <Route path="/participant-configuration-contexte-authentification" element={withRouteVerification("tester-authentication-context-setup", <TesterAuthenticationContextSetup />)} />
        <Route path="/interface-mode-essai-panneau-scenario" element={<Navigate to="/participant-configuration-contexte-authentification" replace />} />

        <Route path="/authentication" element={<Navigate to="/authentification" replace />} />
        <Route path="/auth/callback" element={<Navigate to="/auth/retour" replace />} />
        <Route path="/reset-password" element={<Navigate to="/reinitialiser-mot-de-passe" replace />} />
        <Route path="/home-search" element={<Navigate to="/accueil-recherche" replace />} />
        <Route path="/user-profile-documents" element={<Navigate to="/profil-documents-utilisateur" replace />} />
        <Route path="/equipment-detail/:id" element={<LegacyEquipmentDetailRedirect />} />
        <Route path="/booking-request/:id" element={<LegacyBookingRequestRedirect />} />
        <Route path="/payment-processing" element={<Navigate to="/traitement-paiement" replace />} />
        <Route path="/identity-vérification" element={<Navigate to="/verification-identite-location" replace />} />
        <Route path="/user-dashboard" element={<LegacyUserDashboardRedirect />} />
        <Route path="/admin" element={withRouteVerification("admin-access", <AdminAccess />)} />
        <Route path="/admin-dashboard" element={<Navigate to="/administration-tableau-bord" replace />} />
        <Route path="/admin-platform-spec" element={<Navigate to="/administration-cahier-des-charges-plateforme" replace />} />
        <Route path="/admin-test-results-dashboard" element={<Navigate to="/administration-resultats-essais" replace />} />
        <Route path="/admin-moderation" element={<Navigate to="/administration-moderation" replace />} />
        <Route path="/admin-reservation-management" element={<Navigate to="/administration-gestion-reservations" replace />} />
        <Route path="/admin-user-management" element={<Navigate to="/administration-gestion-utilisateurs" replace />} />
        <Route path="/admin-email-tracking" element={<Navigate to="/administration-suivi-courriels" replace />} />
        <Route path="/admin-security-scan" element={<Navigate to="/administration-scan-securite" replace />} />
        <Route path="/admin-task-tracking" element={<Navigate to="/administration-suivi-taches" replace />} />
        <Route path="/admin-categories" element={<Navigate to="/administration-categories" replace />} />
        <Route path="/admin-object-image-library" element={<Navigate to="/administration-bibliotheque-images-demandes" replace />} />
        <Route path="/admin-email-templates" element={<Navigate to="/administration-modeles-courriels" replace />} />
        <Route path="/admin-footer-editor" element={<Navigate to="/administration-editeur-pied-page" replace />} />
        <Route path="/admin-legal-pages" element={<Navigate to="/administration-pages-legales" replace />} />
        <Route path="/admin-faq" element={<Navigate to="/administration-foire-questions" replace />} />
        <Route path="/admin-rental-contract" element={<Navigate to="/administration-contrat-location" replace />} />
        <Route path="/admin-feedbacks" element={<Navigate to="/administration-retours" replace />} />
        <Route path="/admin-notifications" element={<Navigate to="/administration-notifications" replace />} />
        <Route path="/admin-reference-audit" element={<Navigate to="/administration-audit-references" replace />} />
        <Route path="/admin-moderate-requests" element={<Navigate to="/administration-moderation" replace />} />
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
        <Route path="/contact" element={<Navigate to="/support" replace />} />
        <Route path="/settings" element={<Navigate to={ACCOUNT_SECTION_PATHS.settings} replace />} />
        <Route path="/stripe-connect-onboarding" element={<Navigate to="/coordonnees-versement" replace />} />
        <Route path="/mentions-legales" element={<Navigate to="/legal/mentions-legales" replace />} />
        <Route path="/cgu" element={<Navigate to="/legal/cgu" replace />} />
        <Route path="/cgv" element={<Navigate to="/legal/cgv" replace />} />
        <Route path="/politique-confidentialite" element={<Navigate to="/legal/politique-confidentialite" replace />} />
        <Route path="/politique-cookies" element={<Navigate to="/legal/politique-temoins-connexion" replace />} />
        <Route path="/legal/politique-cookies" element={<Navigate to="/legal/politique-temoins-connexion" replace />} />
        <Route path="/legal/connexion-stripe" element={<Navigate to="/coordonnees-versement" replace />} />
        <Route path="/legal/integration-stripe-connect" element={<Navigate to="/coordonnees-versement" replace />} />
        <Route path="/legal/stripe-connect-onboarding" element={<Navigate to="/coordonnees-versement" replace />} />
        <Route path="/reservation-management-dashboard" element={<Navigate to="/mes-reservations" replace />} />
        <Route path="/geolocation-search-enhancement" element={<Navigate to="/amelioration-recherche-geolocalisee" replace />} />
        <Route path="/tester-authentication-context-setup" element={<Navigate to="/participant-configuration-contexte-authentification" replace />} />
        <Route path="/test-mode-interface-with-scenario-panel" element={<Navigate to="/interface-mode-essai-panneau-scenario" replace />} />
        <Route path="*" element={<NotFound />} />
      </RouterRoutes>
      </Suspense>
    </ErrorBoundary>
  );
};

const Routes = () => {
  return (
    <BrowserRouter>
      <AppRouterContent />
    </BrowserRouter>
  );
};

export default Routes;


