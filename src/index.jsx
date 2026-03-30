import React from "react";
import { createRoot } from "react-dom/client";
import "./styles/tailwind.css";
import "./styles/index.css";

const container = document.getElementById("root");
const root = createRoot(container);

const FatalStartupScreen = ({ message }) => (
  <div className="min-h-screen bg-slate-950 text-white px-6 py-12">
    <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Le Matos Du Voisin</p>
      <h1 className="mt-4 text-2xl font-semibold">Demarrage impossible</h1>
      <p className="mt-3 text-sm leading-6 text-slate-200">
        L'application n'a pas pu se charger correctement. Verifiez la configuration du build ou relancez une version
        incluant les variables d'environnement requises.
      </p>
      <pre className="mt-5 overflow-x-auto rounded-2xl bg-black/40 p-4 text-xs leading-5 text-amber-200 whitespace-pre-wrap">
        {message}
      </pre>
    </div>
  </div>
);

async function bootstrap() {
  try {
    const [
      { default: App },
      { AuthProvider },
      { CookieConsentProvider }
    ] = await Promise.all([
      import("./App"),
      import("./contexts/AuthContext"),
      import("./contexts/CookieConsentContext")
    ]);

    root.render(
      <AuthProvider>
        <CookieConsentProvider>
          <App />
        </CookieConsentProvider>
      </AuthProvider>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur de demarrage inconnue.";
    console.error("Application bootstrap failed:", error);
    root.render(<FatalStartupScreen message={message} />);
  }
}

bootstrap();
