import React from 'react';

import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import IdentityVerificationAdminPanel from '../admin-user-management/components/IdentityVerificationAdminPanel';

const DocumentVerificationAdmin = () => {
  return (
    <div className="min-h-screen bg-[#eef6ff]">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 lg:px-8">
        <IdentityVerificationAdminPanel defaultStatusFilter="pending" />
      </main>

      <Footer />
    </div>
  );
};

export default DocumentVerificationAdmin;
