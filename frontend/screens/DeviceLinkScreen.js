import { View, Text, FlatList, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

export default function DeviceLinkScreen({ navigation }) {
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [linking, setLinking] = useState(null);

  useEffect(() => { fetchAvailableDevices(); }, []);

  const fetchAvailableDevices = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE_URL}/devices/available`);
      const data = await res.json();
      setDevices(Array.isArray(data) ? data : []);
    } catch {
      Alert.alert("Error", "Could not fetch devices.");
    } finally {
      setIsLoading(false);
    }
  };

  const linkDevice = async (deviceId) => {
    try {
      setLinking(deviceId);
      const user = JSON.parse(await AsyncStorage.getItem("user"));
      const userId = user.user_id || user.id;

      const res = await fetch(`${API_BASE_URL}/devices/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: deviceId, user_id: userId })
      });

      if (!res.ok) {
        Alert.alert("Failed", (await res.json()).detail || "Could not link.");
        return;
      }

      await AsyncStorage.setItem("user", JSON.stringify({ ...user, device_id: deviceId }));
      Alert.alert("Success", `${deviceId} linked!`, [
        { text: "OK", onPress: () => navigation.replace("Main") }
      ]);
    } catch {
      Alert.alert("Error", "Linking failed.");
    } finally {
      setLinking(null);
    }
  };

  if (isLoading) return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
      <ActivityIndicator size="large" color="#10B981" />
      <Text style={{ marginTop: 12, color: '#64748B' }}>Scanning for devices...</Text>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top']}>
      <View style={{ flex: 1, padding: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#0F172A', marginBottom: 8 }}>Link Device</Text>
        <Text style={{ color: '#64748B', marginBottom: 24 }}>Select the Cognia device to link to your account.</Text>

        {devices.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Text style={{ color: '#94A3B8' }}>No unlinked devices found.</Text>
            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>Make sure the device is powered on.</Text>
            <Pressable onPress={fetchAvailableDevices} style={{ marginTop: 20 }}>
              <Text style={{ color: '#10B981', fontWeight: 'bold' }}>Refresh</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={devices}
            keyExtractor={i => i.device_id}
            renderItem={({ item }) => (
              <View style={{
                backgroundColor: '#FFF', borderRadius: 12, padding: 16,
                marginBottom: 12, flexDirection: 'row',
                justifyContent: 'space-between', alignItems: 'center',
                elevation: 2
              }}>
                <View>
                  <Text style={{ fontWeight: '600', color: '#0F172A' }}>{item.device_id}</Text>
                  <Text style={{ color: '#10B981', fontSize: 12, marginTop: 2 }}>● Online</Text>
                </View>
                <Pressable
                  onPress={() => linkDevice(item.device_id)}
                  disabled={!!linking}
                  style={{ backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, opacity: linking ? 0.6 : 1 }}
                >
                  {linking === item.device_id
                    ? <ActivityIndicator color="#FFF" size="small" />
                    : <Text style={{ color: '#FFF', fontWeight: 'bold' }}>Link</Text>}
                </Pressable>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}