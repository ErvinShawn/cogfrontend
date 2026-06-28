import { View, Text, Pressable, Alert, TextInput, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useState, useEffect, useRef, useMemo } from 'react';
import * as Location from 'expo-location';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';

import styles from '../styles/screens/GeofenceScreenStyles';
import { geofenceService } from '../services/geofenceService';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

export default function GeofenceScreen() {
  const webviewRef = useRef(null);
  const [initialRegion, setInitialRegion] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [radius, setRadius] = useState("30");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeout = useRef(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setIsLoading(true);
    let fallbackLocation = { latitude: 15.2815, longitude: 74.0220 };

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      try {
        const loc = await Location.getCurrentPositionAsync({});
        fallbackLocation = loc.coords;
      } catch (err) {
        console.log("Could not fetch GPS, using default.");
      }
    }

    try {
      const savedGf = await geofenceService.getGeofence("pi_001");
      if (savedGf && savedGf.latitude) {
        setMapCenter({ latitude: savedGf.latitude, longitude: savedGf.longitude });
        setInitialRegion({ latitude: savedGf.latitude, longitude: savedGf.longitude });
        if (savedGf.radius_meters) setRadius(String(savedGf.radius_meters));
      } else {
        setMapCenter(fallbackLocation);
        setInitialRegion(fallbackLocation);
      }
    } catch (error) {
      setMapCenter(fallbackLocation);
      setInitialRegion(fallbackLocation);
    }

    setIsLoading(false);
  }

  // ── "Use My Location" button handler ──────────────────────────
  const goToMyLocation = async () => {
    setIsLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "Enable location access to use this feature.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = loc.coords;
      setMapCenter({ latitude, longitude });

      // Move the Leaflet map + marker to the new position
      webviewRef.current?.injectJavaScript(`
        if (typeof updateMap !== 'undefined') {
          updateMap(${latitude}, ${longitude}, null);
          map.setView([${latitude}, ${longitude}], 18);
        }
        true;
      `);
    } catch (err) {
      Alert.alert("Location Error", "Could not fetch current location.");
    } finally {
      setIsLocating(false);
    }
  };

  // ── Landmark search (Nominatim / OpenStreetMap) ───────────────
  const handleSearchChange = (text) => {
    setSearchQuery(text);
    clearTimeout(searchTimeout.current);

    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `${NOMINATIM_URL}?q=${encodeURIComponent(text)}&format=json&limit=5`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        setSearchResults(data);
      } catch (e) {
        console.error("Search error", e);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const selectSearchResult = (result) => {
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);
    setMapCenter({ latitude, longitude });
    setSearchQuery(result.display_name.split(',').slice(0, 2).join(','));
    setSearchResults([]);

    webviewRef.current?.injectJavaScript(`
      if (typeof updateMap !== 'undefined') {
        updateMap(${latitude}, ${longitude}, null);
        map.setView([${latitude}, ${longitude}], 17);
      }
      true;
    `);
  };

  // ── Save ──────────────────────────────────────────────────────
  const saveGeofence = async () => {
    if (!mapCenter) return;
    setIsSaving(true);
    try {
      await geofenceService.setGeofence(
        "pi_001",
        mapCenter.latitude,
        mapCenter.longitude,
        Number(radius)
      );
      Alert.alert("Success", "Safe zone synchronized with the patient's device.");
    } catch (error) {
      Alert.alert("Sync Error", "Failed to update geofence on the server.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (webviewRef.current && radius) {
      const clampedRadius = Math.min(100, Math.max(1, Number(radius) || 1));
      webviewRef.current.injectJavaScript(`
        if (typeof updateMap !== 'undefined') { updateMap(null, null, ${clampedRadius}); }
        true;
      `);
    }
  }, [radius]);

  const onMapMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.lat && data.lng) setMapCenter({ latitude: data.lat, longitude: data.lng });
    } catch (e) { console.error("Map parsing error", e); }
  };

  const numericRadius = Number(radius) || 30;

  const leafletHTML = useMemo(() => {
    if (!initialRegion) return '';
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          html, body { height: 100%; width: 100%; margin: 0; padding: 0; background-color: #F8FAFC; }
          #map { height: 100vh; width: 100vw; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', {zoomControl: false}).setView([${initialRegion.latitude}, ${initialRegion.longitude}], 18);

          L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            maxZoom: 20
          }).addTo(map);

          var centerMarker = L.marker([${initialRegion.latitude}, ${initialRegion.longitude}], { draggable: true }).addTo(map);
          var circle = L.circle([${initialRegion.latitude}, ${initialRegion.longitude}], {
            radius: ${radius}, color: '#10B981', fillColor: '#10B981', fillOpacity: 0.25, weight: 2, dashArray: '5,5'
          }).addTo(map);

          centerMarker.on('drag', function(e) { circle.setLatLng(centerMarker.getLatLng()); });
          centerMarker.on('dragend', function(e) {
            var pos = centerMarker.getLatLng();
            window.ReactNativeWebView.postMessage(JSON.stringify({ lat: pos.lat, lng: pos.lng }));
          });

          window.updateMap = function(lat, lng, rad) {
            if(lat && lng) { var nc = [lat, lng]; centerMarker.setLatLng(nc); circle.setLatLng(nc); }
            if(rad) { circle.setRadius(rad); }
          };
        </script>
      </body>
      </html>
    `;
  }, [initialRegion]);

  if (isLoading || !initialRegion) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  const isValidRadius = Number(radius) >= 1 && Number(radius) <= 100;

  return (
    <View style={styles.container}>

      {/* ── Search Bar (floats above the map) ── */}
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

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <View style={searchStyles.dropdown}>
            {searchResults.map((result, index) => (
              <Pressable
                key={result.place_id}
                style={({ pressed }) => [
                  searchStyles.dropdownItem,
                  index < searchResults.length - 1 && searchStyles.dropdownDivider,
                  pressed && { backgroundColor: '#F1F5F9' },
                ]}
                onPress={() => selectSearchResult(result)}
              >
                <Ionicons name="location-outline" size={15} color="#10B981" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={searchStyles.dropdownText} numberOfLines={2}>
                  {result.display_name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* ── "Use My Location" FAB ── */}
      <Pressable
        style={({ pressed }) => [
          locationStyles.fab,
          pressed && { transform: [{ scale: 0.95 }] },
          isLocating && { backgroundColor: '#E2E8F0' },
        ]}
        onPress={goToMyLocation}
        disabled={isLocating}
      >
        {isLocating
          ? <ActivityIndicator size="small" color="#10B981" />
          : <Ionicons name="navigate" size={22} color="#10B981" />
        }
      </Pressable>

      {/* Info Banner */}
      <View style={[styles.statusBanner, { backgroundColor: '#3B82F6' }]}>
        <Ionicons name="information-circle" size={20} color="#FFF" style={{ marginRight: 8 }} />
        <Text style={styles.statusText}>Drag the marker to set the safe zone center.</Text>
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
        <Text style={styles.helper}>Adjust the maximum allowed distance.</Text>

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
          style={({ pressed }) => [
            styles.button,
            (!isValidRadius || isSaving) && styles.buttonDisabled,
            pressed && isValidRadius && { transform: [{ scale: 0.98 }] },
          ]}
          onPress={saveGeofence}
          disabled={!isValidRadius || isSaving}
        >
          {isSaving
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.buttonText}>Save Geofence</Text>
          }
        </Pressable>
      </View>
    </View>
  );
}

// ── Inline styles for new elements ───────────────────────────────

const searchStyles = {
  searchWrapper: {
    position: 'absolute',
    top: 60,          // sits just below the status banner
    left: 12,
    right: 12,
    zIndex: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    paddingVertical: 0,   // remove default Android padding
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dropdownDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  dropdownText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
};

const locationStyles = {
  fab: {
    position: 'absolute',
    bottom: 310,          // sits just above the controls panel
    right: 16,
    zIndex: 10,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
};