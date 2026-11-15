import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';
import { loginStyles as styles } from '@/styles/loginStyles';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function LoginScreen() {
  const [email, setEmail] = useState('altstudio@gmail.com');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter(); 
  const { loginUser } = useAuth();

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', {
        email: email,
        password: password,
      });

      const loggedInUser = response.data.user; 

      if (loggedInUser) {
        loginUser(loggedInUser);
      }

      router.replace('/(tabs)'); 

    } catch (error: any) {
      console.error(error);
      if (error.response) {
        Alert.alert('Ошибка входа', error.response.data.message || 'Неверный email или пароль');
      } else {
        Alert.alert('Ошибка сети', 'Не удалось связаться с сервером.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>ФЛОУЕРП</Text>
        <Text style={styles.subtitle}>Вход в систему</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Пароль</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Войти</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}