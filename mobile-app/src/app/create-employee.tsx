import api from '@/services/api';
import { createEmployeeStyles as styles } from '@/styles/createEmployeeStyles';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function CreateEmployeeScreen() {
  const router = useRouter();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [birthday, setBirthday] = useState('');
  
  const [password, setPassword] = useState(Math.random().toString(36).slice(-8));
  const [role, setRole] = useState('WORKER');
  const [isLoading, setIsLoading] = useState(false);

  const roles = [
    { label: 'Сотрудник', value: 'WORKER' },
    { label: 'Менеджер', value: 'MANAGER' },
    { label: 'Админ', value: 'ADMIN' },
  ];

  const generatePassword = () => {
    setPassword(Math.random().toString(36).slice(-8));
  };

  const handleCreate = async () => {
    if (!firstName || !lastName || !email || !password) {
      Alert.alert('Ошибка', 'Заполните обязательные поля (Имя, Фамилия, Email)');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/admin/employees', {
        first_name: firstName,
        last_name: lastName,
        email: email,
        password: password,
        role: role,
        phone: phone || null,
        position: position || null,
        birthday: birthday || null,
        skills: null,
        socials: {}
      });

      Alert.alert('Успех', `Сотрудник создан!\nПароль: ${password}`);
      router.back(); 
    } catch (error: any) {
      console.error('Ошибка создания сотрудника:', error.response?.data);
      Alert.alert('Ошибка', error.response?.data?.message || 'Не удалось создать сотрудника');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Новый сотрудник</Text>

      <Text style={styles.label}>Имя *</Text>
      <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Введите имя" />

      <Text style={styles.label}>Фамилия *</Text>
      <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Введите фамилию" />

      <Text style={styles.label}>Email *</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="user@example.com" keyboardType="email-address" autoCapitalize="none" />

      <Text style={styles.label}>Пароль (можно сгенерировать)</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
        <TextInput style={[styles.input, { flex: 1, marginBottom: 0 }]} value={password} onChangeText={setPassword} />
        <TouchableOpacity style={{ marginLeft: 10, padding: 12, backgroundColor: '#e0e7ff', borderRadius: 8 }} onPress={generatePassword}>
          <Ionicons name="refresh" size={20} color="#0055ff" />
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Должность</Text>
      <TextInput style={styles.input} value={position} onChangeText={setPosition} placeholder="Например: Frontend-разработчик" />

      <Text style={styles.label}>Телефон</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+7 (999) 999-99-99" keyboardType="phone-pad" />

      <Text style={styles.label}>Дата рождения</Text>
      <TextInput style={styles.input} value={birthday} onChangeText={setBirthday} placeholder="ГГГГ-ММ-ДД (например: 1995-10-12)" />

      <Text style={styles.label}>Роль *</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 30 }}>
        {roles.map((r) => (
          <TouchableOpacity 
            key={r.value} 
            style={{ flex: 1, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: role === r.value ? '#0055ff' : '#eee' }}
            onPress={() => setRole(r.value)}
          >
            <Text style={{ color: role === r.value ? '#fff' : '#333', fontWeight: 'bold' }}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Добавить сотрудника</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}