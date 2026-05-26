import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { alertService } from '../services/alertService';

const AlertsContext = createContext(null);
const POLL_INTERVAL_MS = 3000;

function getStorageKey(userId) {
  return `alerts_last_seen_${userId}`;
}

export function AlertsProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [bannerAlert, setBannerAlert] = useState(null);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);
  const latestAlertIdRef = useRef(null);
  const bannerTimeoutRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const dismissBanner = useCallback(() => {
    setBannerAlert(null);
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
      bannerTimeoutRef.current = null;
    }
  }, []);

  const showBanner = useCallback((alert) => {
    setBannerAlert(alert);
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
    bannerTimeoutRef.current = setTimeout(() => {
      setBannerAlert(null);
      bannerTimeoutRef.current = null;
    }, 3500);
  }, []);

  const refreshAlerts = useCallback(async ({ markSeen = false, suppressBanner = false } = {}) => {
    try {
      const userString = await AsyncStorage.getItem('user');
      if (!userString) {
        setAlerts([]);
        setHasUnread(false);
        latestAlertIdRef.current = null;
        setIsLoadingAlerts(false);
        return [];
      }

      const user = JSON.parse(userString);
      const userId = user.user_id || user.id;
      if (!userId) {
        setAlerts([]);
        setHasUnread(false);
        latestAlertIdRef.current = null;
        setIsLoadingAlerts(false);
        return [];
      }

      const response = await alertService.getUserAlerts(userId);
      const latestId = response[0]?.id ? String(response[0].id) : null;
      const storageKey = getStorageKey(userId);

      if (!suppressBanner && latestId && latestAlertIdRef.current && latestId !== latestAlertIdRef.current) {
        showBanner(response[0]);
      }
      latestAlertIdRef.current = latestId;

      if (markSeen && latestId) {
        await AsyncStorage.setItem(storageKey, latestId);
        setHasUnread(false);
      } else {
        const lastSeenId = await AsyncStorage.getItem(storageKey);
        setHasUnread(Boolean(latestId && latestId !== lastSeenId));
      }

      setAlerts(response);
      setIsLoadingAlerts(false);
      return response;
    } catch (error) {
      console.log('Refresh alerts error:', error?.response?.data || error.message);
      setAlerts([]);
      setHasUnread(false);
      setIsLoadingAlerts(false);
      return [];
    }
  }, [showBanner]);

  const markAlertsSeen = useCallback(async () => {
    const userString = await AsyncStorage.getItem('user');
    if (!userString || alerts.length === 0) {
      setHasUnread(false);
      return;
    }

    const user = JSON.parse(userString);
    const userId = user.user_id || user.id;
    const latestId = alerts[0]?.id;
    if (!userId || !latestId) {
      setHasUnread(false);
      return;
    }

    await AsyncStorage.setItem(getStorageKey(userId), String(latestId));
    setHasUnread(false);
  }, [alerts]);

  useEffect(() => {
    refreshAlerts({ suppressBanner: true });

    const intervalId = setInterval(async () => {
      const userString = await AsyncStorage.getItem('user');
      if (userString) refreshAlerts();  // only poll if logged in
    }, POLL_INTERVAL_MS);

    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      const wasBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      appStateRef.current = nextAppState;

      if (wasBackground && nextAppState === 'active') {
        refreshAlerts();
      }
    });

    return () => {
      clearInterval(intervalId);
      appStateSubscription.remove();
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
    };
  }, [refreshAlerts]);

  return (
    <AlertsContext.Provider
      value={{
        alerts,
        hasUnread,
        bannerAlert,
        isLoadingAlerts,
        refreshAlerts,
        markAlertsSeen,
        dismissBanner,
      }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertsProvider');
  }
  return context;
}
