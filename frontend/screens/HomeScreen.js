import { View, Text, ScrollView, Pressable, Animated, Image, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles/screens/HomeScreenStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deviceService } from '../services/deviceService';
import { geofenceService } from '../services/geofenceService';
import { API_BASE_URL } from '../config';

const isOnline = (lastSeen) => {
  if (!lastSeen) return false;
  return (Date.now() - new Date(lastSeen).getTime()) / 1000 < 60;
};

const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const AnimatedActionBtn = ({ title, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[styles.actionBtnContainer, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        style={styles.actionBtn}
        onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start()}
        onPress={onPress}
      >
        <Text style={styles.actionText}>{title}</Text>
      </Pressable>
    </Animated.View>
  );
};

export default function HomeScreen({ navigation }) {
  const [pstatus, setStatus] = useState(null);
  const [deviceData, setDeviceData] = useState(null);
  const [activeGeofence, setActiveGeofence] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);
  const [isBreached, setIsBreached] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pollRef = useRef(null);
  const deviceDataRef = useRef(null);
  const geofenceRef = useRef(null);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const checkBreach = (device, geofence) => {
    if (!device?.latitude || !device?.longitude || !geofence?.latitude) return false;
    const dist = haversine(device.latitude, device.longitude, geofence.latitude, geofence.longitude);
    return dist > (geofence.radius_meters || 60);
  };

  const startPolling = (interval) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const userString = await AsyncStorage.getItem("user");
        if (!userString) return;
        const user = JSON.parse(userString);
        const userId = user.user_id || user.id;
        const devices = await deviceService.getUserDevices(userId);
        const mainDevice = devices && devices.length > 0 ? devices[0] : null;
        if (!mainDevice) return;

        const online = isOnline(mainDevice.last_seen);
        if (!online) {
          // device offline — stop polling
          clearInterval(pollRef.current);
          pollRef.current = null;
        }

        deviceDataRef.current = mainDevice;
        setDeviceData(mainDevice);

        const breached = checkBreach(mainDevice, geofenceRef.current);
        setIsBreached(breached);

        // if breach state changed, restart polling at new interval
        const newInterval = breached ? 10000 : 60000;
        if (breached !== checkBreach(deviceDataRef.current, geofenceRef.current)) {
          startPolling(newInterval);
        }

        setStatus(prev => prev ? {
          ...prev,
          zone: breached ? "Outside Zone" : (mainDevice?.latitude ? "Safe" : "-"),
          connection: online ? "Online" : (mainDevice?.status?.charAt(0).toUpperCase() + mainDevice?.status?.slice(1)) || "Offline",
          faceDetection: mainDevice?.face_detection,
          objectDetection: mainDevice?.object_detection,
        } : prev);
      } catch { }
    }, interval);
  };

  useFocusEffect(useCallback(() => {
    loadAllData();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []));

  async function loadAllData() {
    try {
      setIsLoading(true);
      const userString = await AsyncStorage.getItem("user");
      if (!userString) return;
      const user = JSON.parse(userString);
      const userId = user.user_id || user.id;

      const devices = await deviceService.getUserDevices(userId);
      const mainDevice = devices && devices.length > 0 ? devices[0] : null;
      setDeviceData(mainDevice);
      deviceDataRef.current = mainDevice;

      let gf = null;
      if (mainDevice) {
        try {
          gf = await geofenceService.getGeofence(mainDevice.device_id);
          if (gf && gf.latitude) { setActiveGeofence(gf); geofenceRef.current = gf; }
        } catch { }
      }

      // fetch reminder count
      try {
        if (mainDevice?.device_id) {
          const res = await fetch(`${API_BASE_URL}/routines/device/${mainDevice.device_id}`);
          const data = await res.json();
          const reminders = data?.reminders || [];
          setReminderCount(Array.isArray(reminders) ? reminders.length : 0);
        }
      } catch { }

      const online = isOnline(mainDevice?.last_seen);
      const breached = checkBreach(mainDevice, gf);
      setIsBreached(breached);

      setStatus({
        name: user.patient_name,
        condition: user.medical_condition,
        photo: user.profile_photo_url,
        zone: breached ? "Outside Zone" : (mainDevice?.latitude ? "Safe" : "-"),
        connection: online
          ? "Online"
          : (mainDevice?.status?.charAt(0).toUpperCase() + mainDevice?.status?.slice(1)) || "Offline",
        faceDetection: mainDevice?.face_detection,
        objectDetection: mainDevice?.object_detection,
      });

      // start polling — fast if breached, normal if online, skip if offline
      if (online) startPolling(breached ? 10000 : 60000);

    } catch (err) {
      console.log("Error loading data:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAllData();
    setIsRefreshing(false);
  };

  const openDirections = () => {
    const targetLat = deviceData?.latitude || activeGeofence?.latitude;
    const targetLng = deviceData?.longitude || activeGeofence?.longitude;
    if (!targetLat || !targetLng) return;
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}`)
      .catch(err => console.error("Couldn't load Google Maps", err));
  };

  const mapHTML = useMemo(() => {
    const gfLat = activeGeofence?.latitude;
    const gfLng = activeGeofence?.longitude;
    const gfRad = activeGeofence?.radius_meters || 60;
    const piLat = deviceData?.latitude || gfLat;
    const piLng = deviceData?.longitude || gfLng;

    if (!piLat || !piLng) return `
      <html><body style="background:#F8FAFC;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif">
      <p style="color:#94A3B8;font-size:14px">Waiting for device location...</p></body></html>`;

    const circleColor = isBreached ? '#EF4444' : '#10B981';

    return `
      <!DOCTYPE html><html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body { height: 100%; margin: 0; padding: 0; }
          #map { height: 100vh; width: 100vw; }
          .device-marker { background-color: #EF4444; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(239,68,68,0.8); }
        </style>
      </head>
      <body><div id="map"></div><script>
        var map = L.map('map', { zoomControl: false, dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false });
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(map);
        ${gfLat && gfLng ? `L.circle([${gfLat}, ${gfLng}], { radius: ${gfRad}, color: '${circleColor}', weight: 2, dashArray: '5, 5', fillColor: '${circleColor}', fillOpacity: 0.2 }).addTo(map);` : ''}
        var deviceIcon = L.divIcon({ className: 'device-marker', iconSize: [18, 18], iconAnchor: [9, 9] });
        L.marker([${piLat}, ${piLng}], { icon: deviceIcon }).addTo(map);
        ${gfLat && gfLng
          ? `map.fitBounds([[${gfLat}, ${gfLng}], [${piLat}, ${piLng}]], { padding: [25, 25], maxZoom: 17 });`
          : `map.setView([${piLat}, ${piLng}], 16);`
        }
        map.on('click', function() { window.ReactNativeWebView.postMessage('open_maps'); });
      </script></body></html>`;
  }, [deviceData, activeGeofence, isBreached]);

  if (isLoading || !pstatus) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  const online = pstatus.connection === "Active";

  return (
    <Animated.ScrollView
      style={[styles.container, { opacity: fadeAnim }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#10B981" />}
    >
      <Pressable
        style={styles.patientCard}
        onPress={() => navigation.navigate('Profile', { user: { ...pstatus, user_id: deviceData?.user_id }, deviceData })}
      >
        {pstatus.photo
          ? <Image source={{ uri: pstatus.photo }} style={styles.avatar} />
          : <View style={[styles.avatar, { backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={32} color="#94A3B8" />
            </View>
        }
        <View style={styles.patientInfoWrap}>
          <Text style={styles.name}>{pstatus.name}</Text>
          <Text style={styles.meta}>{pstatus.condition}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? '#10B981' : '#94A3B8' }} />
          <Text style={{ fontSize: 12, color: online ? '#10B981' : '#94A3B8', fontFamily: 'Inter', fontWeight: '600' }}>
            {online ? 'Online' : 'Offline'}
          </Text>
        </View>
      </Pressable>

      {isBreached && (
        <View style={{ backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FECACA' }}>
          <Ionicons name="warning" size={18} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={{ color: '#EF4444', fontWeight: '700', fontFamily: 'Inter', fontSize: 14 }}>Patient is outside the safe zone!</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Live Status</Text>

      <View style={styles.statusRow}>
        <View style={styles.statusBox}>
          <Text style={[styles.statusValue, isBreached && { color: '#EF4444' }]}>{pstatus.zone}</Text>
          <Text style={styles.statusLabel}>Zone</Text>
        </View>
        <View style={styles.statusBox}>
          <Text style={[styles.statusValue, !pstatus.faceDetection && { color: '#94A3B8' }]}>
            {pstatus.faceDetection ? 'Active' : 'Off'}
          </Text>
          <Text style={styles.statusLabel}>Face Detection</Text>
        </View>
        <View style={styles.statusBox}>
          <Text style={[styles.statusValue, !pstatus.objectDetection && { color: '#94A3B8' }]}>
            {pstatus.objectDetection ? 'Active' : 'Off'}
          </Text>
          <Text style={styles.statusLabel}>Object Detection</Text>
        </View>
      </View>

      <View style={[styles.statusRow, { marginBottom: 25 }]}>
        <View style={styles.statusBox}>
          <Text style={styles.statusValue}>{reminderCount}</Text>
          <Text style={styles.statusLabel}>Reminders</Text>
        </View>
        <View style={styles.statusBox}>
          <Text style={[styles.statusValue, !online && { color: '#94A3B8' }]}>
            {pstatus.connection}
          </Text>
          <Text style={styles.statusLabel}>Network</Text>
        </View>
        <View style={styles.statusBox}>
          <Text style={styles.statusValue}>Watching</Text>
          <Text style={styles.statusLabel}>Cognia</Text>
        </View>
      </View>

      <View style={styles.mapWrapper}>
        <WebView
          key={`${deviceData?.latitude}-${deviceData?.longitude}-${activeGeofence?.latitude}-${activeGeofence?.radius_meters}-${isBreached}`}
          originWhitelist={['*']}
          source={{ html: mapHTML }}
          style={styles.map}
          scrollEnabled={false}
          javaScriptEnabled
          domStorageEnabled
          onMessage={(event) => { if (event.nativeEvent.data === 'open_maps') openDirections(); }}
        />
        <View style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 6 }}>
          <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold' }}>Tap map for directions</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        <AnimatedActionBtn title="Known People" onPress={() => navigation.navigate('Known')} />
        <AnimatedActionBtn title="Edit Geofence" onPress={() => navigation.navigate('Geofence')} />
        <AnimatedActionBtn title="View Alerts" onPress={() => navigation.navigate('Alerts')} />
        <AnimatedActionBtn title="Profile Details" onPress={() => navigation.navigate('Profile', { user: { ...pstatus, user_id: deviceData?.user_id }, deviceData })} />
      </View>
    </Animated.ScrollView>
  );
}