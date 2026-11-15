import api from '@/services/api';
import { createProjectStyles as styles } from '@/styles/createProjectStyles';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function CreateProjectScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Ошибка', 'Название проекта обязательно');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/projects', {
        name: name,
        description: description,
      });

      Alert.alert('Успех', 'Проект успешно создан!');

      router.back(); 

    } catch (error: any) {
      console.error('Ошибка создания проекта:', error.response?.data);
      Alert.alert('Ошибка', error.response?.data?.message || 'Не удалось создать проект');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Новый проект</Text>

      <Text style={styles.label}>Название проекта *</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Например: Разработка мобильного приложения"
      />

      <Text style={styles.label}>Описание</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Кратко опишите суть проекта..."
        multiline
      />

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Создать проект</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}