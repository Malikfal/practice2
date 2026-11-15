import api from '@/services/api';
import { createTaskStyles as styles } from '@/styles/createTaskStyles';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function CreateTaskScreen() {
  const { projectId, projectName } = useLocalSearchParams<{ projectId: string, projectName: string }>();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Ошибка', 'Название задачи обязательно');
      return;
    }

    setIsLoading(true);
    try {
      await api.post(`/projects/${projectId}/tasks`, {
        title: title,
        description: description,
      });

      Alert.alert('Успех', 'Задача успешно создана!');
      
      router.back(); 

    } catch (error: any) {
      console.error('Ошибка создания задачи:', error.response?.data);
      Alert.alert('Ошибка', error.response?.data?.message || 'Не удалось создать задачу');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Новая задача</Text>
      <Text style={{ color: '#666', marginBottom: 20 }}>Для проекта: {projectName}</Text>

      <Text style={styles.label}>Название задачи *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Например: Сверстать экран логина"
      />

      <Text style={styles.label}>Описание</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Детали задачи..."
        multiline
      />

      <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Создать задачу</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}