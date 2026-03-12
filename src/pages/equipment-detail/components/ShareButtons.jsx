import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '../../../components/AppIcon';
import {
  buildSocialShareUrl,
  downloadPromotionImage,
  shareOnInstagram
} from '../../../services/socialPromotionService';
import { trackAnalyticsEvent } from '../../../utils/analyticsTracking';
import { openExternalWindow } from '../../../utils/nativeRuntime';

const ShareButtons = ({ title, description, url, imageUrl, itemId, itemCategory }) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || window?.location?.href || '';
  const shareTitle = title || 'Decouvrez cette annonce';
  const shareDescription = description || 'Le Matos du Voisin - Location de materiel entre particuliers';
  const socialSharePayload = {
    title: shareTitle,
    description: shareDescription,
    url: shareUrl,
    imageUrl
  };

  const handleCopyLink = async () => {
    try {
      await navigator?.clipboard?.writeText(shareUrl);
      trackAnalyticsEvent('share', {
        method: 'copy_link',
        content_type: 'listing',
        item_id: itemId ? String(itemId) : undefined,
        item_category: itemCategory || undefined
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Echec lors de la copie :', err);
    }
  };

  const shareLinks = [
    {
      name: 'Instagram',
      method: 'instagram',
      icon: 'Instagram',
      color: 'bg-[#E1306C] hover:bg-[#c1275c]',
      url: buildSocialShareUrl('instagram', socialSharePayload)
    },
    {
      name: 'Facebook',
      method: 'facebook',
      icon: 'Facebook',
      color: 'bg-[#1877F2] hover:bg-[#0d65d9]',
      url: buildSocialShareUrl('facebook', socialSharePayload)
    },
    {
      name: 'X',
      method: 'x',
      icon: 'BrandX',
      color: 'bg-slate-900 hover:bg-slate-800',
      url: buildSocialShareUrl('x', socialSharePayload)
    },
    {
      name: 'LinkedIn',
      method: 'linkedin',
      icon: 'Linkedin',
      color: 'bg-[#0A66C2] hover:bg-[#084d91]',
      url: buildSocialShareUrl('linkedin', socialSharePayload)
    },
    {
      name: 'Pinterest',
      method: 'pinterest',
      icon: 'BrandPinterest',
      color: 'bg-[#E60023] hover:bg-[#c4001d]',
      url: buildSocialShareUrl('pinterest', socialSharePayload)
    },
    {
      name: 'WhatsApp',
      method: 'whatsapp',
      icon: 'MessageCircle',
      color: 'bg-[#25D366] hover:bg-[#1fb855]',
      url: `https://wa.me/?text=${encodeURIComponent(`${shareTitle} ${shareUrl}`)}`
    },
    {
      name: 'E-mail',
      method: 'email',
      icon: 'Mail',
      color: 'bg-[#6B7280] hover:bg-[#4B5563]',
      url: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodeURIComponent(`${shareDescription}\n\n${shareUrl}`)}`
    }
  ].filter((target) => Boolean(target?.url));

  const handleShare = async (shareTargetUrl, method) => {
    trackAnalyticsEvent('share', {
      method,
      content_type: 'listing',
      item_id: itemId ? String(itemId) : undefined,
      item_category: itemCategory || undefined
    });

    if (method === 'instagram') {
      const result = await shareOnInstagram(socialSharePayload);

      if (result?.openedCount === 0) {
        toast?.error("Le navigateur a bloque l'ouverture d'Instagram.");
        return;
      }

      if (result?.copiedText) {
        toast?.success('Legende Instagram copiee. Collez-la ensuite dans votre publication.');
      } else {
        toast?.success("Instagram ouvert. Ajoutez maintenant votre visuel et le lien de l'annonce.");
      }

      return;
    }

    await openExternalWindow(shareTargetUrl, '_blank', 'width=720,height=680');
  };

  const handleDownloadInstagramVisual = async () => {
    if (!imageUrl) return;

    try {
      const result = await downloadPromotionImage(socialSharePayload);

      if (result?.downloaded) {
        toast?.success('Visuel Instagram telecharge.');
        return;
      }

      if (result?.openedPreview) {
        toast?.success("Visuel ouvert. Enregistrez-le ensuite depuis l'onglet.");
        return;
      }

      toast?.error('Impossible de recuperer le visuel pour le moment.');
    } catch (error) {
      console.error('Telechargement visuel Instagram impossible :', error);
      toast?.error(error?.message || 'Impossible de telecharger le visuel.');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
        <Icon name="Share2" size={20} className="text-[#17a2b8]" />
        Partager cette annonce
      </h3>
      <div className="flex flex-wrap gap-3">
        {shareLinks?.map((social) => (
          <button
            key={social?.name}
            onClick={() => void handleShare(social?.url, social?.method)}
            className={`${social?.color} text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5`}
            title={`Partager sur ${social?.name}`}
          >
            <Icon name={social?.icon} size={18} />
            <span className="font-medium text-sm">{social?.name}</span>
          </button>
        ))}

        <button
          onClick={handleCopyLink}
          className={`${
            copied ? 'bg-[#28a745]' : 'bg-[#17a2b8]'
          } hover:bg-[#138496] text-white px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5`}
          title="Copier le lien"
        >
          <Icon name={copied ? 'Check' : 'Link'} size={18} />
          <span className="font-medium text-sm">
            {copied ? 'Lien copie !' : 'Copier le lien'}
          </span>
        </button>

        {imageUrl ? (
          <button
            onClick={() => void handleDownloadInstagramVisual()}
            className="bg-[#F3F4F6] hover:bg-[#E5E7EB] text-slate-800 px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all duration-200 hover:shadow-lg transform hover:-translate-y-0.5"
            title="Telecharger le visuel Instagram"
          >
            <Icon name="Download" size={18} />
            <span className="font-medium text-sm">Visuel Instagram</span>
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default ShareButtons;
