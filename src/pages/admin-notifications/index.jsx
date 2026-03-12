import React, { useEffect, useMemo, useState } from 'react';
import Header from '../../components/navigation/Header';
import Footer from '../../components/Footer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const CHANNEL_ICONS = {
  email: 'Mail',
  push: 'Bell',
  sms: 'MessageSquare'
};

const inferChannels = (rows) => {
  const channels = new Set();

  rows?.forEach((row) => {
    const payload = row?.payload || {};
    const explicitChannel = String(payload?.channel || payload?.delivery_channel || '')?.toLowerCase();

    if (explicitChannel === 'email' || explicitChannel === 'push' || explicitChannel === 'sms') {
      channels?.add(explicitChannel);
    }
  });

  if (channels?.size === 0) channels?.add('push');
  return [...channels];
};

const humanizeType = (type) => {
  return String(type || 'inconnu')
    ?.replace(/_/g, ' ')
    ?.replace(/\b\w/g, (char) => char?.toUpperCase());
};

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date?.getTime())) return '-';

  return date?.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const AdminNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setFetchError('');

      const sinceDate = new Date();
      sinceDate?.setMonth(sinceDate?.getMonth() - 3);

      const { data, error } = await supabase
        ?.from('notifications')
        ?.select('*')
        ?.gte('created_at', sinceDate?.toISOString())
        ?.order('created_at', { ascending: false })
        ?.limit(3000);

      if (error) throw error;
      setNotifications(Array?.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erreur de chargement des notifications admin:', error);
      setFetchError(error?.message || 'Impossible de charger les notifications');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const groupedTypes = useMemo(() => {
    const grouped = (notifications || [])?.reduce((acc, row) => {
      const type = String(row?.type || 'inconnu');

      if (!acc?.[type]) {
        acc[type] = {
          type,
          name: humanizeType(type),
          rows: [],
          triggerCount: 0,
          readCount: 0,
          unreadCount: 0,
          clickedCount: 0,
          lastTriggeredAt: null
        };
      }

      const item = acc?.[type];
      item?.rows?.push(row);
      item.triggerCount += 1;
      item.readCount += row?.is_read ? 1 : 0;
      item.unreadCount += row?.is_read ? 0 : 1;
      item.clickedCount += row?.payload?.clicked || row?.payload?.action_taken ? 1 : 0;

      const rowDate = row?.created_at;
      if (!item?.lastTriggeredAt || (rowDate && rowDate > item?.lastTriggeredAt)) {
        item.lastTriggeredAt = rowDate;
      }

      return acc;
    }, {});

    return Object.values(grouped || {})
      ?.map((item) => ({
        ...item,
        channels: inferChannels(item?.rows),
        openRate: item?.triggerCount > 0 ? (item?.readCount / item?.triggerCount) * 100 : 0,
        clickRate: item?.triggerCount > 0 ? (item?.clickedCount / item?.triggerCount) * 100 : 0
      }))
      ?.sort((a, b) => b?.triggerCount - a?.triggerCount);
  }, [notifications]);

  const filteredTypes = useMemo(() => {
    const query = String(searchQuery || '')?.trim()?.toLowerCase();
    if (!query) return groupedTypes;

    return groupedTypes?.filter((item) => {
      const name = String(item?.name || '')?.toLowerCase();
      const type = String(item?.type || '')?.toLowerCase();
      return name?.includes(query) || type?.includes(query);
    });
  }, [groupedTypes, searchQuery]);

  const monthStats = useMemo(() => {
    const monthStart = new Date();
    monthStart?.setDate(1);
    monthStart?.setHours(0, 0, 0, 0);

    const currentMonthRows = (notifications || [])?.filter((row) => {
      const created = new Date(row?.created_at || 0);
      return created >= monthStart;
    });

    const sentCount = currentMonthRows?.length || 0;
    const readCount = currentMonthRows?.filter((row) => row?.is_read)?.length || 0;
    const clickedCount = currentMonthRows?.filter((row) => row?.payload?.clicked || row?.payload?.action_taken)?.length || 0;

    const openRate = sentCount > 0 ? (readCount / sentCount) * 100 : 0;
    const clickRate = sentCount > 0 ? (clickedCount / sentCount) * 100 : 0;

    return {
      activeTypes: groupedTypes?.length || 0,
      sentCount,
      openRate: Number(openRate?.toFixed(1)),
      clickRate: Number(clickRate?.toFixed(1))
    };
  }, [groupedTypes, notifications]);

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <Header />

      <main className="flex-1 container mx-auto px-4 pt-20 pb-6 md:pt-24 md:pb-8">
        <div className="mb-6">
          <Link to="/administration-tableau-bord" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
            <Icon name="ArrowLeft" size={16} />
            Retour au tableau de bord
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Gerer les notifications</h1>
            <p className="text-muted-foreground">Vue réelle des notifications envoyees aux utilisateurs</p>
          </div>
          <Button iconName="RefreshCw" onClick={loadNotifications} loading={loading}>
            Actualiser
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
                <Icon name="Bell" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{monthStats?.activeTypes}</p>
                <p className="text-xs text-muted-foreground">Types actifs</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10 text-success">
                <Icon name="Send" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{monthStats?.sentCount}</p>
                <p className="text-xs text-muted-foreground">Envoyees ce mois</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10 text-warning">
                <Icon name="Eye" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{monthStats?.openRate}%</p>
                <p className="text-xs text-muted-foreground">Taux de lecture</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-elevation-1 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
                <Icon name="MousePointerClick" size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{monthStats?.clickRate}%</p>
                <p className="text-xs text-muted-foreground">Taux de clic</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-elevation-1 p-4 mb-6">
          <Input
            placeholder="Rechercher un type de notification..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e?.target?.value || '')}
          />
        </div>

        {fetchError && (
          <div className="bg-error/10 border border-error/20 text-error rounded-lg px-4 py-3 mb-6 text-sm">
            {fetchError}
          </div>
        )}

        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-lg shadow-elevation-1 p-8 text-center text-muted-foreground">
              Chargement des notifications...
            </div>
          ) : filteredTypes?.length === 0 ? (
            <div className="bg-white rounded-lg shadow-elevation-1 p-8 text-center text-muted-foreground">
              Aucune notification trouvee.
            </div>
          ) : (
            filteredTypes?.map((item) => (
              <div key={item?.type} className="bg-white rounded-lg shadow-elevation-1 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">{item?.name}</h3>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                        {item?.triggerCount} declenchements
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground mb-3">Type technique: {item?.type}</p>

                    <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Icon name="CheckCircle" size={12} />
                        Lus: {item?.readCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="Clock" size={12} />
                        Non lues: {item?.unreadCount}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Icon name="Calendar" size={12} />
                        Dernier envoi: {formatDate(item?.lastTriggeredAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs text-muted-foreground">Canaux:</span>
                      {item?.channels?.map((channel) => (
                        <div
                          key={`${item?.type}-${channel}`}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-xs"
                        >
                          <Icon name={CHANNEL_ICONS?.[channel] || 'Bell'} size={12} />
                          <span className="capitalize">{channel === 'email' ? 'e-mail' : channel}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-right min-w-[130px]">
                    <p className="text-sm text-muted-foreground">Lecture</p>
                    <p className="text-lg font-semibold text-foreground">{item?.openRate?.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground mt-2">Clic</p>
                    <p className="text-lg font-semibold text-foreground">{item?.clickRate?.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AdminNotifications;

