import { AuthProvider } from '@/context/AuthContext';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" /> 
        <Stack.Screen name="(tabs)" />
        <Stack.Screen 
          name="create-project" 
          options={{ 
            presentation: 'modal',
            headerShown: true,
            title: 'Создание проекта' 
          }} 
        />
        <Stack.Screen 
          name="project/[id]" 
          options={{
            title: 'Задачи',
            headerBackTitle: 'Назад' 
          }} 
        />
        <Stack.Screen 
          name="create-task" 
          options={{ 
            presentation: 'modal', 
            title: 'Новая задача' 
          }} 
        />
        <Stack.Screen 
          name="task/[id]" 
          options={{ 
            title: 'Детали задачи',
            headerBackTitle: 'Назад'
          }} 
        />
        <Stack.Screen 
        name="create-employee" 
        options={{ 
          presentation: 'modal', 
          title: 'Новый сотрудник' 
        }} 
      />

      <Stack.Screen 
        name="project/add-member" 
        options={{ 
          presentation: 'modal',
          title: 'Добавить в проект' 
        }} 
      />

      <Stack.Screen 
        name="employee/[id]" 
        options={{ 
          title: 'Профиль сотрудника',
          headerBackTitle: 'Назад'
        }} 
      />

      <Stack.Screen 
        name="employee/add-assignment" 
        options={{ 
          presentation: 'modal', 
          title: 'Назначение на проект' 
        }} 
      />

      <Stack.Screen 
        name="employee/add-time" 
        options={{ 
          presentation: 'modal', 
          title: 'Добавить время' 
        }} 
      />
      </Stack>
    </AuthProvider>
  );
}