import React, { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { Checkbox } from "../../components/ui/Checkbox";
import { useAuth } from "../../contexts/AuthContext";
import adminService from "../../services/adminService";
import { grantAdminAccess, isAdminAccessGranted } from "../../utils/adminAccessGate";

const getAdminPassword = () => {
  const fromNextPublic = String(import.meta.env?.NEXT_PUBLIC_ADMIN_PASSWORD || "").trim();
  const fromVite = String(import.meta.env?.VITE_ADMIN_ACCESS_PASSWORD || "").trim();
  return fromNextPublic || fromVite;
};

const toAdminPathOrFallback = (path, fallback = "/administration-tableau-bord") => {
  if (typeof path === "string" && path.startsWith("/administration-")) {
    return path;
  }
  return fallback;
};

const AdminAccess = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading, profileLoading, refreshProfile, userProfile } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const configuredPassword = useMemo(() => getAdminPassword(), []);

  const redirectPath = useMemo(() => {
    return toAdminPathOrFallback(location?.state?.from);
  }, [location?.state?.from]);

  if (loading || (isAuthenticated && profileLoading && !userProfile)) {
    return (
      <div className="min-h-screen app-page-gradient px-4 py-10 md:py-16 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/70 mb-4">
            <div className="w-6 h-6 rounded-full border-4 border-[#0ea5b7]/20 border-t-[#0ea5b7] animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Verification de l'acces admin...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/authentification" replace state={{ from: redirectPath }} />;
  }

  const handleSubmit = async (event) => {
    event?.preventDefault();

    if (!configuredPassword) {
      setError("Le mot de passe admin n'est pas configure.");
      return;
    }

    if (password !== configuredPassword) {
      setError("Mot de passe incorrect.");
      return;
    }

    try {
      setSubmitting(true);

      const { error: adminGrantError } = await adminService?.grantCurrentUserAdminAccess(password);
      if (adminGrantError) {
        setError(adminGrantError?.message || "Impossible d'activer l'acces administrateur.");
        return;
      }

      await refreshProfile?.();
      grantAdminAccess({ persistent: rememberDevice });
      navigate(redirectPath, { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen app-page-gradient px-4 py-10 md:py-16">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-elevation-2 border border-border p-6 md:p-8">
        <h1 className="text-2xl font-bold text-foreground">Acces administration</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Saisissez le mot de passe pour continuer.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Input
            label="Mot de passe admin"
            type="password"
            name="adminPassword"
            autoComplete="current-password"
            value={password}
            onChange={(event) => {
              setPassword(event?.target?.value || "");
              if (error) setError("");
            }}
            error={error}
            required
          />

          <Checkbox
            label="Se souvenir de cet appareil"
            description="Garde l'accès admin ouvert plus longtemps sur ce navigateur."
            checked={rememberDevice}
            onChange={(event) => setRememberDevice(Boolean(event?.target?.checked))}
          />

          <Button type="submit" size="lg" fullWidth loading={submitting} disabled={submitting}>
            Continuer
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link to="/accueil-recherche" className="text-sm text-primary hover:underline">
            Retour au site
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminAccess;



