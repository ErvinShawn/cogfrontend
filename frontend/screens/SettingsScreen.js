import { View, Text, Switch, ScrollView, Pressable, Animated, Alert } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles/screens/SettingsScreenStyles';
import { Colors } from '../constants/colors';
import { deviceService } from '../services/deviceService'; // ✅ Imported the service
import AsyncStorage from '@react-native-async-storage/async-storage'

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
  // State for hardware toggles
  const [objectDetection, setObjectDetection] = useState(true);
  const [faceDetection, setFaceDetection] = useState(true);

  // State for comfort and audio
  const [voicePrompts, setVoicePrompts] = useState(true);
  const [quietHours, setQuietHours] = useState(false);

  // Voice Cycling Logic
  const voices = ['Female (Calm)', 'Female (Standard)', 'Male (Deep)', 'Male (Standard)'];
  const [voiceIndex, setVoiceIndex] = useState(0);

  const cycleVoice = () => {
    setVoiceIndex((prevIndex) => (prevIndex + 1) % voices.length);
  };

  // Entrance Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true })
    ]).start();
  }, []);

  // ✅ Backend Toggle Handler: Object Detection
  const handleObjectDetectionToggle = async (newValue) => {
    setObjectDetection(newValue); // Optimistic UI update
    try {
      await deviceService.updateDevice("pi_001", { object_detection: newValue });
      console.log(`Object Detection set to: ${newValue}`);
    } catch (error) {
      setObjectDetection(!newValue); // Revert if backend fails
      Alert.alert("Connection Error", "Failed to update device settings. Please check your network.");
    }
  };

  // ✅ Backend Toggle Handler: Face Recognition
  const handleFaceDetectionToggle = async (newValue) => {
    setFaceDetection(newValue); // Optimistic UI update
    try {
      await deviceService.updateDevice("pi_001", { face_detection: newValue });
      console.log(`Face Recognition set to: ${newValue}`);
    } catch (error) {
      setFaceDetection(!newValue); // Revert if backend fails
      Alert.alert("Connection Error", "Failed to update device settings. Please check your network.");
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Section 1: AI Capabilities */}
          <Text style={styles.sectionHeader}>Vision Modules</Text>
          <View style={styles.card}>
            <SettingToggle
              icon="scan-outline"
              title="Object Detection"
              value={objectDetection}
              onValueChange={handleObjectDetectionToggle} // ✅ Attached backend function
            />
            <View style={styles.divider} />
            <SettingToggle
              icon="happy-outline"
              title="Face Recognition"
              value={faceDetection}
              onValueChange={handleFaceDetectionToggle} // ✅ Attached backend function
              isLast
            />
          </View>

          {/* Section 2: Audio & Patient Comfort */}
          <Text style={styles.sectionHeader}>Audio & Comfort</Text>
          <View style={styles.card}>
            <SettingToggle
              icon="volume-high-outline"
              title="Voice Prompts"
              value={voicePrompts}
              onValueChange={setVoicePrompts}
            />
            <View style={styles.divider} />
            <SettingLink
              icon="person-voice-outline"
              title="Voice Profile"
              valueText={voices[voiceIndex]}
              onPress={cycleVoice}
            />
            <View style={styles.divider} />
            <SettingToggle
              icon="moon-outline"
              title="Quiet Hours (10 PM - 6 AM)"
              value={quietHours}
              onValueChange={setQuietHours}
              isLast
            />
          </View>

          {/* Section 3: Device Management */}
          <Text style={styles.sectionHeader}>Device Management</Text>
          <View style={styles.card}>
            <SettingLink
              icon="hardware-chip-outline"
              title="Device Information"
              onPress={() => Alert.alert("Device Info", "MAC: B8:27:EB:4A:9C\nIP: 192.168.1.105\nFirmware: 1.0.4")}
              isLast
            />
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