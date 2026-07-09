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
  const slideAnim = useRef(new Animated.Value(20)).current; // Slightly reduced for a smoother snap effect
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true })
    ]).start();
  }, []);

  const handleSignIn = async () => {
    if (loading) return;
    try {
      setError("");
      const normalizedEmail = email.trim().toLowerCase();
      const submittedPassword = password;

      if (!normalizedEmail || !submittedPassword) {
        setError("Please enter email and password.");
        return;
      }

      setLoading(true);
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
      await registerPushToken(data.user_id);
      navigation.replace("Main");

    } catch (err) {
      console.log("Login error:", err);
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
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
            <Text style={styles.subtitle}>Sign in to manage controls.</Text>

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
                isPassword={true} // Triggers the show/hide feature inside the component
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <AppButton 
              title={loading ? "Signing In..." : "Sign In"} 
              onPress={handleSignIn} 
              disabled={loading}
            />

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