import { View, Text, Pressable, Animated, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import AppInput from '../components/AppInput';
import AppButton from '../components/AppButton';
import styles from '../styles/screens/SignInScreenStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { registerPushToken } from '../services/notification'; 

export default function SignInScreen({ navigation }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 40, friction: 7, useNativeDriver: true })
    ]).start();
  }, []);

  const handleSignIn = async () => {
    try {
      setError("");
      const normalizedEmail = email.trim().toLowerCase();
      const submittedPassword = password;

      if (!normalizedEmail || !submittedPassword) {
        setError("Please enter email and password.");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password: submittedPassword })
      });

      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setError("Unexpected server response.");
        return;
      }

      if (!res.ok) {
        setError(data.error || data.detail || "Login failed. Please try again.");
        return;
      }
      if (data.error) {
        setError(data.error);
        return;
      }

      await AsyncStorage.setItem("user", JSON.stringify(data));
      await registerPushToken(data.user_id); // add this — runs after login, before navigation
      navigation.replace("Main");

    } catch (err) {
      console.log("Login error:", err);
      setError(`Network error. Check backend at ${API_BASE_URL}.`);
    }
  };
  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.keyboardAvoid}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            <View style={styles.logoPlaceholder} />
            
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to manage Cognia controls.</Text>

            <View style={styles.formContainer}>
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
            </View>

            {error ? (
              <Text style={{ color: "red", marginBottom: 10 }}>
                {error}
              </Text>
            ) : null}

            <AppButton title="Sign In" onPress={handleSignIn} />

            <Pressable
              onPress={() => navigation.navigate('SignUp')}
              style={styles.linkContainer}
            >
              <Text style={styles.link}>
                Don’t have an account?{" "}
                <Text style={styles.linkBold}>Sign Up</Text>
              </Text>
            </Pressable>

          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}