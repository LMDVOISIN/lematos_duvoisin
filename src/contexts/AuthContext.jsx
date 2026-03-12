import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import authService from '../services/authService';
import profileService from '../services/profileService';
import userTestingService from '../services/userTestingService';
import { clearAdminAccess } from '../utils/adminAccessGate';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isTester, setIsTester] = useState(false);
  const [testerData, setTesterData] = useState(null);

  // Opérations asynchrones isolées - jamais appelées depuis les rappels d'authentification
  const profileOperations = {
    async load(userId) {
      if (!userId) return;
      setProfileLoading(true);
      try {
        const { data, error } = await profileService?.getProfile(userId);
        if (!error && data) {
          setUserProfile(data);
          
          // Check if user is a tester
          const { data: testerInfo } = await userTestingService?.checkIfTester(data?.email);
          if (testerInfo) {
            setIsTester(true);
            setTesterData(testerInfo);
          } else {
            setIsTester(false);
            setTesterData(null);
          }
        }
      } catch (error) {
        console.error('Erreur de chargement du profil :', error);
      } finally {
        setProfileLoading(false);
      }
    },

    clear() {
      setUserProfile(null);
      setProfileLoading(false);
      setIsTester(false);
      setTesterData(null);
      clearAdminAccess();
    }
  };

  // Gestionnaires d'état d'authentification - protégés des modifications asynchrones
  const authStateHandlers = {
    // Ce gestionnaire DOIT rester synchrone - exigence Supabase
    onChange: (event, session) => {
      setUser(session?.user || null);
      setLoading(false);
      
      if (session?.user) {
        profileOperations?.load(session?.user?.id); // Appel sans attente
      } else {
        profileOperations?.clear();
      }
    }
  };

  useEffect(() => {
    // Vérification initiale de session
    supabase?.auth?.getSession()?.then(({ data: { session } }) => {
      authStateHandlers?.onChange(null, session);
    });

    // CRITIQUE : ceci doit rester synchrone
    const { data: { subscription } } = supabase?.auth?.onAuthStateChange(
      authStateHandlers?.onChange
    );

    return () => subscription?.unsubscribe();
  }, []);

  /**
   * Inscription d'un nouvel utilisateur
   * Creates user in auth.users and profile in user_profiles
   */
  const signUp = async (email, password, metadata = {}) => {
    try {
      const { data, error } = await authService?.signUp(email, password, metadata);
      
      if (error) {
        return { data: null, error };
      }

      // Le profil sera créé par un déclencheur de base de données
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: "Impossible de créer le compte. Merci de réessayer." } };
    }
  };

  /**
   * Connexion avec e-mail et mot de passe
   */
  const signIn = async (email, password) => {
    try {
      const { data, error } = await authService?.signIn(email, password);
      return { data, error };
    } catch (error) {
      return { data: null, error: { message: 'Connexion impossible. Merci de réessayer.' } };
    }
  };

  /**
   * Déconnecter l'utilisateur courant
   */
  const signOut = async () => {
    try {
      const { error } = await authService?.signOut();
      if (!error) {
        setUser(null);
        profileOperations?.clear();
      }
      return { error };
    } catch (error) {
      return { error: { message: 'Déconnexion impossible. Merci de réessayer.' } };
    }
  };

  /**
   * Supprimer le compte utilisateur courant
   */
  const deleteAccount = async () => {
    if (!user?.id) {
      return { data: null, error: { message: 'Aucun utilisateur connecté.' } };
    }

    try {
      const { data, error } = await authService?.deleteCurrentAccount();
      if (error) return { data: null, error };

      try {
        await supabase?.auth?.signOut({ scope: 'local' });
      } catch (_localSignOutError) {
        try {
          await supabase?.auth?.signOut();
        } catch (_ignored) {
          // La session locale peut déjà être invalide après suppression côté Auth.
        }
      }

      setUser(null);
      profileOperations?.clear();
      setLoading(false);

      return { data, error: null };
    } catch (_error) {
      return {
        data: null,
        error: { message: 'Suppression du compte impossible. Merci de réessayer.' }
      };
    }
  };

  /**
   * Réinitialiser le mot de passe - envoie un e-mail de réinitialisation
   */
  const resetPassword = async (email) => {
    try {
      const { data, error } = await authService?.resetPassword(email);
      return { data, error };
    } catch (error) {
      return { data: null, error: { message: "Impossible de réinitialiser le mot de passe. Merci de réessayer." } };
    }
  };

  /**
   * Mettre à jour les métadonnées utilisateur
   */
  const updateUserMetadata = async (metadata) => {
    try {
      const { data, error } = await authService?.updateUserMetadata(metadata);
      return { data, error };
    } catch (error) {
      return { data: null, error: { message: 'Mise à jour impossible. Merci de réessayer.' } };
    }
  };

  /**
   * Mettre à jour le profil utilisateur
   */
  const updateProfile = async (updates) => {
    if (!user) return { data: null, error: { message: 'Aucun utilisateur connecté' } };
    
    try {
      const { data, error } = await profileService?.updateProfile(user?.id, updates);
      if (!error && data) {
        setUserProfile(data);
      }
      return { data, error };
    } catch (error) {
      return { data: null, error: { message: 'Mise à jour du profil impossible. Merci de réessayer.' } };
    }
  };

  /**
   * Rafraîchir le profil utilisateur
   */
  const refreshProfile = async () => {
    if (!user) return;
    await profileOperations?.load(user?.id);
  };

  /**
   * Vérifier si l'e-mail est confirmé
   */
  const isEmailVerified = () => {
    return user?.email_confirmed_at != null;
  };

  /**
   * Connexion via un fournisseur OAuth
   */
  const signInWithOAuth = async (provider) => {
    try {
      const { data, error } = await authService?.signInWithOAuth(provider);
      return { data, error };
    } catch (error) {
      return { data: null, error: { message: 'Connexion via fournisseur externe impossible. Merci de réessayer.' } };
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    profileLoading,
    signUp,
    signIn,
    signOut,
    deleteAccount,
    resetPassword,
    updateUserMetadata,
    updateProfile,
    refreshProfile,
    isEmailVerified,
    signInWithOAuth,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};




