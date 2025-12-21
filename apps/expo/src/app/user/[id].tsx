import { useQuery } from '@tanstack/react-query';
import { Stack, useGlobalSearchParams } from 'expo-router';
import { SafeAreaView, Text, View } from 'react-native';

import { trpc } from '~/utils/api';

export default function User() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const { data } = useQuery(trpc.user.byId.queryOptions({ id }));

  if (!data) return null;

  return (
    <SafeAreaView className="bg-background">
      <Stack.Screen options={{ title: data.id }} />
      <View className="h-full w-full p-4">
        <Text className="text-primary py-2 text-3xl font-bold">{data.id}</Text>
      </View>
    </SafeAreaView>
  );
}
