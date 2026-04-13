import 'react-native-get-random-values'
import React from 'react'
import { View, ActivityIndicator } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useAuth } from './src/hooks/useAuth'
import { SignInScreen } from './src/screens/SignInScreen'
import { AppNavigator } from './src/navigation/AppNavigator'

function RootNavigator() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0f0f1a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#6c63ff" size="large" />
      </View>
    )
  }
  return user ? <AppNavigator /> : <SignInScreen />
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
