import { useAuth } from '@/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function TabsLayout() {
  const { hasPermission, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0055ff" />
      </View>
    );
  }

  const canViewEmployees = hasPermission('employees.view_list');

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#0055ff', headerShown: false }}>
      <Tabs.Screen 
        name="index" 
        options={{ title: 'Главная', tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> }} 
      />
      
      <Tabs.Screen 
        name="projects" 
        options={{ title: 'Проекты', tabBarIcon: ({ color }) => <Ionicons name="folder" size={24} color={color} /> }} 
      />
      
      {/* ВСЕГДА рендерим вкладку, но управляем её видимостью через href */}
      <Tabs.Screen 
        name="employees" 
        options={{ 
          title: 'Сотрудники', 
          tabBarIcon: ({ color }) => <Ionicons name="people" size={24} color={color} />,
          // Если есть права - показываем (undefined), если нет - скрываем (null)
          href: canViewEmployees ? undefined : null 
        }} 
      />
      
      <Tabs.Screen 
        name="profile" 
        options={{ title: 'Профиль', tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} /> }} 
      />
    </Tabs>
  );
}