import { View, Text, Pressable, Animated, KeyboardAvoidingView, Platform, ScrollView,Image } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import styles from '../styles/screens/SignUpScreenStyles';
import * as ImagePicker from 'expo-image-picker'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_BASE_URL } from '../config'
import { registerPushToken } from '../services/notification';

export default function SignUpScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [patientName, setPatientName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [condition, setCondition] = useState("")
  const [contact, setContact] = useState("")
  const [photo, setPhoto] = useState(null)

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 7, useNativeDriver: true })
    ]).start();
  }, []);

  const pickImage = async () => {
  try {
    // Ask permission first
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (!permissionResult.granted) {
      alert("Permission to access gallery is required!")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8
    })

    if (!result.canceled) {
      setPhoto(result.assets[0])
    }

  } catch (error) {
    console.log("Image picker error:", error)
  }
}

  const handleSignup = async () => {
  try {
    let imageUrl = null

    // 1️⃣ Upload image to Cloudinary first
    if (photo) {
      const cloudData = new FormData()

      cloudData.append("file", {
        uri: photo.uri,
        type: "image/jpeg",
        name: "upload.jpg"
      })

      cloudData.append("upload_preset", "Test_Preset")

      const cloudRes = await fetch(
        "https://api.cloudinary.com/v1_1/diq0bcrjl/image/upload",
        {
          method: "POST",
          body: cloudData
        }
      )

      const cloudJson = await cloudRes.json()
      console.log("Cloudinary response:", cloudJson)
      imageUrl = cloudJson.secure_url
    }
    console.log("Image URL:", imageUrl)
    
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        patient_name: patientName,
        email,
        password,
        medical_condition: condition,
        emergency_contact: contact,
        profile_photo_url: imageUrl
      })
    })

    const data = await res.json()
    console.log(data)
    await AsyncStorage.setItem("user", JSON.stringify(data));
    await registerPushToken(data.user_id); // add this
    navigation.replace("Main");
  } catch (err) {
    console.log("Signup error:", err)
  }
}

  return (
  <KeyboardAvoidingView 
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
    style={styles.keyboardAvoid}
  >
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }}
      >
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Set up Cognia for your loved one.</Text>

        {/* PATIENT DETAILS */}
        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Patient Details</Text>

          <AppInput
            placeholder="Full Name"
            value={patientName}
            onChangeText={setPatientName}
          />

          <AppInput
            placeholder="Email Address"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <AppInput
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <AppInput
            placeholder="Medical Condition"
            value={condition}
            onChangeText={setCondition}
          />

          <AppInput
            placeholder="Emergency Contact Number"
            keyboardType="phone-pad"
            value={contact}
            onChangeText={setContact}
          />

          {/* PROFILE PHOTO */}
          <Pressable onPress={pickImage} style={{ marginVertical: 10 }}>
            <Text>Select Profile Photo</Text>
          </Pressable>

          {photo && (
            <Image
              source={{ uri: photo.uri }}
              style={{
                width: 120,
                height: 120,
                borderRadius: 60,
                alignSelf: "center"
              }}
            />
          )}
        </View>

        <View style={styles.buttonWrapper}>
          <AppButton title="Complete Sign Up" onPress={handleSignup} />
        </View>

        <Pressable
          onPress={() => navigation.navigate('SignIn')}
          style={styles.linkContainer}
        >
          <Text style={styles.link}>
            Already have an account?{" "}
            <Text style={styles.linkBold}>Sign In</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </ScrollView>
  </KeyboardAvoidingView>
);
}