import { View, Text, Pressable, Alert, TextInput, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useState, useEffect, useRef, useMemo } from 'react';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles from '../styles/screens/GeofenceScreenStyles';
import { geofenceService } from '../services/geofenceService';
import { deviceService } from '../services/deviceService';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export default function GeofenceScreen() {
  const webviewRef = useRef(null);
  const [initialRegion, setInitialRegion] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [radius, setRadius] = useState("30");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [deviceLocation, setDeviceLocation] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef(null);

  useEffect(() => { fetchInitialData(); }, []);

  async function fetchInitialData() {
    setIsLoading(true);

    // Get device_id from AsyncStorage
    const userString = await AsyncStorage.getItem("user");
    const user = userString ? JSON.parse(userString) : {};
    const userId = user.user_id || user.id;
    const linkedDeviceId = user.device_id;
    setDeviceId(linkedDeviceId);

    let fallbackLocation = null;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      try {
        const loc = await Location.getCurrentPositionAsync({});
        fallbackLocation = loc.coords;
      } catch { }
    }

    // Fetch device location
    try {
      if (userId) {
        const devices = await deviceService.getUserDevices(userId);
        const mainDevice = devices && devices.length > 0 ? devices[0] : null;
        if (mainDevice?.latitude && mainDevice?.longitude) {
          setDeviceLocation({ latitude: mainDevice.latitude, longitude: mainDevice.longitude });
        }
      }
    } catch { }

    // Fetch geofence
    try {
      const savedGf = await geofenceService.getGeofence(linkedDeviceId);
      if (savedGf && savedGf.latitude) {
        setMapCenter({ latitude: savedGf.latitude, longitude: savedGf.longitude });
        setInitialRegion({ latitude: savedGf.latitude, longitude: savedGf.longitude });
        if (savedGf.radius_meters) setRadius(String(savedGf.radius_meters));
      } else {
        const loc = fallbackLocation || { latitude: 15.2815, longitude: 74.0220 };
        setMapCenter(loc);
        setInitialRegion(loc);
      }
    } catch {
      const loc = fallbackLocation || { latitude: 15.2815, longitude: 74.0220 };
      setMapCenter(loc);
      setInitialRegion(loc);
    }

    setIsLoading(false);
  }

  const goToMyLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert("Permission Denied", "Enable location access."); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      setMapCenter({ latitude, longitude });
      webviewRef.current?.injectJavaScript(`
        if (typeof updateMap !== 'undefined') { updateMap(${latitude}, ${longitude}, null); map.setView([${latitude}, ${longitude}], 18); }
        true;
      `);
    } catch { Alert.alert("Location Error", "Could not fetch current location."); }
    finally { setIsLocating(false); }
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    clearTimeout(searchTimeout.current);
    if (!text.trim()) { setSearchResults([]); return; }
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${NOMINATIM_URL}?q=${encodeURIComponent(text)}&format=json&limit=5`, { headers: { 'Accept-Language': 'en' } });
        setSearchResults(await res.json());
      } catch { } finally { setIsSearching(false); }
    }, 500);
  };

  const selectSearchResult = (result) => {
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);
    setMapCenter({ latitude, longitude });
    setSearchQuery(result.display_name.split(',').slice(0, 2).join(','));
    setSearchResults([]);
    webviewRef.current?.injectJavaScript(`
      if (typeof updateMap !== 'undefined') { updateMap(${latitude}, ${longitude}, null); map.setView([${latitude}, ${longitude}], 17); }
      true;
    `);
  };

  const saveGeofence = async () => {
    if (!mapCenter || !deviceId) { Alert.alert("Error", "No device linked."); return; }
    setIsSaving(true);
    try {
      await geofenceService.setGeofence(deviceId, mapCenter.latitude, mapCenter.longitude, Number(radius));
      Alert.alert("Success", "Safe zone synchronized with the patient's device.");
    } catch { Alert.alert("Sync Error", "Failed to update geofence on the server."); }
    finally { setIsSaving(false); }
  };

  useEffect(() => {
    if (webviewRef.current && radius) {
      const clampedRadius = Math.min(100, Math.max(1, Number(radius) || 1));
      webviewRef.current.injectJavaScript(`
        if (typeof updateMap !== 'undefined') { updateMap(null, null, ${clampedRadius}); } true;
      `);
    }
  }, [radius]);

  const onMapMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.lat && data.lng) setMapCenter({ latitude: data.lat, longitude: data.lng });
    } catch { }
  };

  const numericRadius = Number(radius) || 30;

  const leafletHTML = useMemo(() => {
    if (!initialRegion) return '';
    const piLat = deviceLocation?.latitude;
    const piLng = deviceLocation?.longitude;

    return `
      <!DOCTYPE html><html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>html,body{height:100%;width:100%;margin:0;padding:0}#map{height:100vh;width:100vw}</style>
      </head>
      <body><div id="map"></div><script>
        var map = L.map('map', {zoomControl: false}).setView([${initialRegion.latitude}, ${initialRegion.longitude}], 18);
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {maxZoom: 20}).addTo(map);

        var centerMarker = L.marker([${initialRegion.latitude}, ${initialRegion.longitude}], { draggable: true }).addTo(map);
        var circle = L.circle([${initialRegion.latitude}, ${initialRegion.longitude}], {
          radius: ${radius}, color: '#10B981', fillColor: '#10B981', fillOpacity: 0.25, weight: 2, dashArray: '5,5'
        }).addTo(map);

        centerMarker.on('drag', function(e) { circle.setLatLng(centerMarker.getLatLng()); });
        centerMarker.on('dragend', function(e) {
          var pos = centerMarker.getLatLng();
          window.ReactNativeWebView.postMessage(JSON.stringify({ lat: pos.lat, lng: pos.lng }));
        });

        ${piLat && piLng ? `
        var deviceIcon = L.divIcon({
          className: '',
          html: '<div style="width:14px;height:14px;border-radius:50%;background:#EF4444;border:2.5px solid white;box-shadow:0 0 8px rgba(239,68,68,0.6)"></div>',
          iconSize: [14, 14], iconAnchor: [7, 7]
        });
        L.marker([${piLat}, ${piLng}], {icon: deviceIcon}).addTo(map)
          .bindPopup('Patient Location').openPopup();
        ` : ''}

        window.updateMap = function(lat, lng, rad) {
          if(lat && lng) { var nc = [lat, lng]; centerMarker.setLatLng(nc); circle.setLatLng(nc); }
          if(rad) { circle.setRadius(rad); }
        };
      </script></body></html>`;
  }, [initialRegion, deviceLocation]);

  if (isLoading || !initialRegion) {
    return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
      <ActivityIndicator size="large" color="#10B981" />
    </View>;
  }

  const isValidRadius = Number(radius) >= 1 && Number(radius) <= 100;

  return (
    <View style={styles.container}>
      <View style={searchStyles.searchWrapper}>
        <View style={searchStyles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
          <TextInput
            style={searchStyles.searchInput}
            placeholder="Search landmark or address…"
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
          />
          {isSearching && <ActivityIndicator size="small" color="#10B981" style={{ marginLeft: 8 }} />}
          {searchQuery.length > 0 && !isSearching && (
            <Pressable onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </Pressable>
          )}
        </View>
        {searchResults.length > 0 && (
          <View style={searchStyles.dropdown}>
            {searchResults.map((result, index) => (
              <Pressable
                key={result.place_id}
                style={({ pressed }) => [searchStyles.dropdownItem, index < searchResults.length - 1 && searchStyles.dropdownDivider, pressed && { backgroundColor: '#F1F5F9' }]}
                onPress={() => selectSearchResult(result)}
              >
                <Ionicons name="location-outline" size={15} color="#10B981" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={searchStyles.dropdownText} numberOfLines={2}>{result.display_name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Pressable
        style={({ pressed }) => [locationStyles.fab, pressed && { transform: [{ scale: 0.95 }] }, isLocating && { backgroundColor: '#E2E8F0' }]}
        onPress={goToMyLocation}
        disabled={isLocating}
      >
        {isLocating ? <ActivityIndicator size="small" color="#10B981" /> : <Ionicons name="navigate" size={22} color="#10B981" />}
      </Pressable>

      <View style={[styles.statusBanner, { backgroundColor: deviceLocation ? '#10B981' : '#3B82F6' }]}>
        <Ionicons name={deviceLocation ? "location" : "information-circle"} size={20} color="#FFF" style={{ marginRight: 8 }} />
        <Text style={styles.statusText}>
          {deviceLocation ? "Red dot = patient location. Drag marker to set safe zone." : "Drag the marker to set the safe zone center."}
        </Text>
      </View>

      <View style={styles.mapContainer}>
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: leafletHTML }}
          style={styles.map}
          onMessage={onMapMessage}
          javaScriptEnabled={true}
        />
      </View>

      <View style={styles.controls}>
        <View style={styles.handleBar} />
        <Text style={styles.title}>Safe Zone Configuration</Text>
        <Text style={styles.helper}>Adjust the maximum allowed distance from home.</Text>

        <View style={styles.radiusHeader}>
          <Text style={styles.valueLabel}>Radius Size</Text>
          <TextInput
            style={styles.radiusInput}
            keyboardType="numeric"
            value={radius}
            onChangeText={(val) => {
              let parsed = val.replace(/[^0-9]/g, '');
              if (Number(parsed) > 100) parsed = "100";
              setRadius(parsed);
            }}
          />
          <Text style={styles.unitText}>meters</Text>
        </View>

        <Slider
          style={styles.slider}
          minimumValue={1}
          maximumValue={100}
          value={numericRadius}
          onValueChange={(val) => setRadius(String(Math.round(val)))}
          minimumTrackTintColor="#10B981"
          maximumTrackTintColor="#E2E8F0"
          thumbTintColor="#10B981"
        />

        <Pressable
          style={({ pressed }) => [styles.button, (!isValidRadius || isSaving) && styles.buttonDisabled, pressed && isValidRadius && { transform: [{ scale: 0.98 }] }]}
          onPress={saveGeofence}
          disabled={!isValidRadius || isSaving}
        >
          {isSaving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Save Safe Zone</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const searchStyles = {
  searchWrapper: { position: 'absolute', top: 60, left: 12, right: 12, zIndex: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  searchInput: { flex: 1, fontSize: 14, color: '#1E293B', paddingVertical: 0 },
  dropdown: { backgroundColor: '#FFFFFF', borderRadius: 12, marginTop: 6, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  dropdownItem: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 11 },
  dropdownDivider: { borderBottomWidth: 0.5, borderBottomColor: '#E2E8F0' },
  dropdownText: { flex: 1, fontSize: 13, color: '#334155', lineHeight: 18 },
};

const locationStyles = {
  fab: { position: 'absolute', bottom: 310, right: 16, zIndex: 10, width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
};