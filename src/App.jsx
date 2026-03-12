import React from "react";
import { Toaster } from 'react-hot-toast';
import Routes from "./Routes";
import CookieConsentBanner from './components/cookies/CookieConsentBanner';
import SiteChatbot from './components/chatbot/SiteChatbot';

function App() {
  return (
    <>
      <Routes />
      <CookieConsentBanner />
      <SiteChatbot />
      <Toaster 
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 4000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </>
  );
}

export default App;
