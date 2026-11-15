import api from '@/services/api';
import { profileStyles as styles } from '@/styles/profileStyles';
import DateTimePicker from '@react-native-community/datetimepicker'; // <-- Импортируем календарь
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function ProfileScreen() {
  const router = useRouter();
  
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [birthdayDate, setBirthdayDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const fetchProfile = async () => {
    try {
      const response = await api.get('/profile');
      const data = response.data.data || response.data;
      setUserData(data);
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setPhone(data.phone || '');
      
      if (data.birthday) {
        setBirthdayDate(new Date(data.birthday));
      }
    } catch (error) {
      console.error('Ошибка загрузки профиля:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [])
  );

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBirthdayDate(selectedDate);
    }
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await api.put('/profile', {
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
        birthday: birthdayDate ? formatDate(birthdayDate) : null,
        email: userData?.email,
        skills: userData?.skills || null,
        socials: userData?.socials || {},
      });
      Alert.alert('Успех', 'Данные профиля сохранены');
      fetchProfile();
    } catch (error: any) {
      console.error('Ошибка сохранения:', error.response?.data);
      const errorMsg = error.response?.data?.message || 'Не удалось сохранить профиль';
      Alert.alert('Ошибка', errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      Alert.alert('Ошибка', 'Новые пароли не совпадают');
      return;
    }
    if (!currentPassword || !newPassword) {
      Alert.alert('Ошибка', 'Заполните все поля пароля');
      return;
    }

    setIsSaving(true);
    try {
      await api.put('/profile/password', {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      Alert.alert('Успех', 'Пароль изменен');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Ошибка смены пароля:', error.response?.data);
      Alert.alert('Ошибка', error.response?.data?.message || 'Не удалось изменить пароль');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } catch (error) {
      console.log('Ошибка при выходе:', error);
    } finally {
      router.replace('/login');
    }
  };

  if (loading) return <ActivityIndicator size="large" style={{ flex: 1 }} />;

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.headerContainer}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {firstName ? firstName[0] : 'U'}
            </Text>
          </View>
          <Text style={styles.title}>{firstName} {lastName}</Text>
          <Text style={styles.subtitle}>{userData?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{userData?.role_label || userData?.role}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Общие данные</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Имя</Text>
          <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="Ваше имя" />

          <Text style={styles.label}>Фамилия</Text>
          <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Ваша фамилия" />

          <Text style={styles.label}>Дата рождения</Text>
          <TouchableOpacity 
            style={[styles.input, { justifyContent: 'center' }]} 
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={{ color: birthdayDate ? '#333' : '#999', fontSize: 16 }}>
              {birthdayDate ? formatDate(birthdayDate) : 'Выберите дату рождения'}
            </Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={birthdayDate || new Date()}
              mode="date"
              display="default"
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )}

          <Text style={styles.label}>Телефон</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+7 (999) 999-99-99" keyboardType="phone-pad" />

          <Text style={styles.label}>Email (нельзя изменить)</Text>
          <TextInput style={[styles.input, styles.readOnlyInput]} value={userData?.email || ''} editable={false} />

          <TouchableOpacity style={styles.button} onPress={handleSaveProfile} disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Сохранить данные</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Настройки безопасности</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Текущий пароль</Text>
          <TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />

          <Text style={styles.label}>Новый пароль</Text>
          <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry />

          <Text style={styles.label}>Повторите новый пароль</Text>
          <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />

          <TouchableOpacity style={styles.button} onPress={handleChangePassword} disabled={isSaving}>
            {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Обновить пароль</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Выйти из аккаунта</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}