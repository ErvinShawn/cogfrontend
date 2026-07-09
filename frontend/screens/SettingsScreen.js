import { View, Text, Switch, ScrollView, Pressable, Animated, Alert } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles/screens/SettingsScreenStyles';
import { Colors } from '../constants/colors';
import { deviceService } from '../services/deviceService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

// ✅ Reusable component for links or actions
const SettingLink = ({ icon, title, isLast, onPress, isDestructive, valueText }) => (
  <Pressable
    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    onPress={onPress}
  >
    <View style={[styles.iconBox, isDestructive && styles.iconBoxDestructive]}>
      <Ionicons name={icon} size={20} color={isDestructive ? '#EF4444' : Colors.primary || '#10B981'} />
    </View>
    <Text style={[styles.itemText, isDestructive && styles.destructiveText]}>{title}</Text>

    {valueText ? (
      <Text style={{ color: '#64748B', fontSize: 14, fontFamily: 'Inter', fontWeight: '500' }}>{valueText}</Text>
    ) : (
      <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
    )}
  </Pressable>
);

// ✅ Reusable component for toggle switches
const SettingToggle = ({ icon, title, value, onValueChange, isLast }) => (
  <View style={styles.row}>
    <View style={styles.iconBox}>
      <Ionicons name={icon} size={20} color={Colors.primary || '#10B981'} />
    </View>
    <Text style={styles.itemText}>{title}</Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#E2E8F0', true: Colors.primary || '#10B981' }}
      thumbColor={'#FFFFFF'}
      ios_backgroundColor="#E2E8F0"
    />
  </View>
);

export default function SettingsScreen({ navigation }) {
  const [objectDetection, setObjectDetection] = useState(true);
  const [faceDetection, setFaceDetection] = useState(true);
  const [voicePrompts, setVoicePrompts] = useState(true);
  const [quietHours, setQuietHours] = useState(false);
  const [linkedDevice, setLinkedDevice] = useState(null);

  const voices = ['Female (Calm)', 'Female (Standard)', 'Male (Deep)', 'Male (Standard)'];
  const [voiceIndex, setVoiceIndex] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true })
    ]).start();
  }, []);

  // Load linked device on mount
  useEffect(() => {
    AsyncStorage.getItem("user").then(str => {
      if (!str) return;
      const u = JSON.parse(str);
      const userId = u.user_id || u.id;
      fetch(`${API_BASE_URL}/devices/user/${userId}`)
        .then(r => r.json())
        .then(data => {
            if (data.length > 0) {
              const d = data[0];
              setLinkedDevice(d.device_id);
              setVoicePrompts(d.voice_prompts ?? true);
              setQuietHours(d.quiet_hours ?? false);
            }
          })
        .catch(err => console.log("Failed to load linked device:", err));
    });
  }, []);

  const cycleVoice = () => {
    setVoiceIndex((prevIndex) => (prevIndex + 1) % voices.length);
  };

  const handleObjectDetectionToggle = async (newValue) => {
    setObjectDetection(newValue);
    try {
      await deviceService.updateDevice(linkedDevice || "pi_002", { object_detection: newValue });
    } catch (error) {
      setObjectDetection(!newValue);
      Alert.alert("Connection Error", "Failed to update device settings.");
    }
  };

  const handleVoicePromptsToggle = async (newValue) => {
  setVoicePrompts(newValue);
  try {
    await deviceService.updateDevice(linkedDevice || "pi_002", { voice_prompts: newValue });
  } catch {
    setVoicePrompts(!newValue);
    Alert.alert("Connection Error", "Failed to update device settings.");
  }
};

const handleQuietHoursToggle = async (newValue) => {
  setQuietHours(newValue);
  try {
    await deviceService.updateDevice(linkedDevice || "pi_002", { quiet_hours: newValue });
  } catch {
    setQuietHours(!newValue);
    Alert.alert("Connection Error", "Failed to update device settings.");
  }
};

  const handleFaceDetectionToggle = async (newValue) => {
    setFaceDetection(newValue);
    try {
      await deviceService.updateDevice(linkedDevice || "pi_002", { face_detection: newValue });
    } catch (error) {
      setFaceDetection(!newValue);
      Alert.alert("Connection Error", "Failed to update device settings.");
    }
  };

  const handleUnlink = () => {
    Alert.alert("Unlink Device", "Are you sure you want to unlink this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unlink",
        style: "destructive",
        onPress: async () => {
          try {
            const user = JSON.parse(await AsyncStorage.getItem("user"));
            const userId = user.user_id || user.id;

            const res = await fetch(`${API_BASE_URL}/devices/unlink`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ device_id: linkedDevice, user_id: userId })
            });

            if (!res.ok) {
              Alert.alert("Error", "Failed to unlink device.");
              return;
            }

            setLinkedDevice(null);
            const updated = { ...user, device_id: null };
            await AsyncStorage.setItem("user", JSON.stringify(updated));
            Alert.alert("Unlinked", "Device has been unlinked from your account.");
          } catch (err) {
            console.log("Unlink error:", err);
            Alert.alert("Error", "Something went wrong.");
          }
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Section 1: Vision Modules */}
          <Text style={styles.sectionHeader}>Vision Modules</Text>
          <View style={styles.card}>
            <SettingToggle
              icon="scan-outline"
              title="Object Detection"
              value={objectDetection}
              onValueChange={handleObjectDetectionToggle}
            />
            <View style={styles.divider} />
            <SettingToggle
              icon="happy-outline"
              title="Face Recognition"
              value={faceDetection}
              onValueChange={handleFaceDetectionToggle}
              isLast
            />
          </View>

          {/* Section 2: Audio & Comfort */}
          <Text style={styles.sectionHeader}>Audio & Comfort</Text>
          <View style={styles.card}>
            <SettingToggle
              icon="volume-high-outline"
              title="Voice Prompts"
              value={voicePrompts}
              onValueChange={handleVoicePromptsToggle}  // ✅
            />
            <View style={styles.divider} />
            <SettingLink
              icon="person-outline"
              title="Voice Profile"
              valueText={voices[voiceIndex]}
              onPress={cycleVoice}
            />
            <View style={styles.divider} />
            <SettingToggle
              icon="moon-outline"
              title="Quiet Hours (10 PM - 6 AM)"
              value={quietHours}
              onValueChange={handleQuietHoursToggle}  // ✅
            />
          </View>

          {/* Section 3: Device Management */}
          <Text style={styles.sectionHeader}>Device Management</Text>
          <View style={styles.card}>
            {linkedDevice ? (
              <>
                <SettingLink
                  icon="hardware-chip-outline"
                  title="Linked Device"
                  valueText={linkedDevice}
                  onPress={() => {}}
                />
                <View style={styles.divider} />
                <SettingLink
                  icon="log-out-outline"
                  title="Unlink Device"
                  isDestructive
                  onPress={handleUnlink}
                  isLast
                />
              </>
            ) : (
              <SettingLink
                icon="hardware-chip-outline"
                title="Link a Device"
                onPress={() => navigation.navigate("DeviceLink")}
                isLast
              />
            )}
          </View>

          {/* Section 4: Account */}
          <Text style={styles.sectionHeader}>Account</Text>
          <View style={styles.card}>
            <SettingLink
              icon="log-out-outline"
              title="Sign Out"
              isDestructive
              onPress={async () => {
                await AsyncStorage.removeItem("user");
                navigation.replace('SignIn');
              }}
              isLast
            />
          </View>

          <Text style={styles.versionText}>Cognia App v1.0.0</Text>

        </Animated.View>
      </ScrollView>
    </View>
  );
}