import { LegendList } from '@legendapp/list';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RouterOutputs } from '~/utils/api';
import { trpc } from '~/utils/api';
import { authClient } from '~/utils/auth';

function UserCard(props: {
  user: RouterOutputs['user']['all'][number];
  onDelete: () => void;
}) {
  return (
    <View className="bg-muted flex flex-row rounded-lg p-4">
      <View className="grow">
        <Link
          asChild
          href={{
            params: { id: props.user.id },
            pathname: '/user/[id]',
          }}
        >
          <Pressable className="">
            <Text className="text-primary text-xl font-semibold">
              {props.user.id}
            </Text>
            <Text className="text-foreground mt-2">{props.user.id}</Text>
          </Pressable>
        </Link>
      </View>
      <Pressable onPress={props.onDelete}>
        <Text className="text-primary font-bold uppercase">Delete</Text>
      </Pressable>
    </View>
  );
}

function CreateUser() {
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState('');

  const { mutate, error } = useMutation(
    trpc.user.create.mutationOptions({
      async onSuccess() {
        setFirstName('');
        await queryClient.invalidateQueries(trpc.user.all.queryFilter());
      },
    }),
  );

  return (
    <View className="mt-4 flex gap-2">
      <TextInput
        className="border-input bg-background text-foreground items-center rounded-md border px-3 text-lg leading-tight"
        onChangeText={setFirstName}
        placeholder="Name"
        value={firstName}
      />
      {error?.data?.zodError?.fieldErrors &&
        (
          error.data.zodError.fieldErrors as Record<
            string,
            string[] | undefined
          >
        ).name && (
          <Text className="text-destructive mb-2">
            {
              (
                error.data.zodError.fieldErrors as Record<
                  string,
                  string[] | undefined
                >
              ).name?.[0]
            }
          </Text>
        )}
      <Pressable
        className="bg-primary flex items-center rounded-sm p-2"
        onPress={() => {
          mutate({
            email: 'test@test.com',
            name: firstName || 'Test User',
          });
        }}
      >
        <Text className="text-foreground">Create</Text>
      </Pressable>
      {error?.data?.code === 'UNAUTHORIZED' && (
        <Text className="text-destructive mt-2">
          You need to be logged in to create a user
        </Text>
      )}
    </View>
  );
}

function MobileAuth() {
  const { data: session } = authClient.useSession();

  return (
    <>
      <Text className="text-foreground pb-2 text-center text-xl font-semibold">
        {session?.user.name ? `Hello, ${session.user.name}` : 'Not logged in'}
      </Text>
      <Pressable
        className="bg-primary flex items-center rounded-sm p-2"
        onPress={() =>
          session
            ? authClient.signOut()
            : authClient.signIn.social({
                callbackURL: '/',
                provider: 'google',
              })
        }
      >
        <Text>{session ? 'Sign Out' : 'Sign In With Google'}</Text>
      </Pressable>
    </>
  );
}

export default function Index() {
  const queryClient = useQueryClient();

  const userQuery = useQuery(trpc.user.all.queryOptions());

  const deleteUserMutation = useMutation(
    trpc.user.delete.mutationOptions({
      onSettled: () =>
        queryClient.invalidateQueries(trpc.user.all.queryFilter()),
    }),
  );

  return (
    <SafeAreaView className="bg-background">
      {/* Changes page title visible on the header */}
      <Stack.Screen options={{ title: 'Home Page' }} />
      <View className="bg-background h-full w-full p-4">
        <Text className="text-foreground pb-2 text-center text-5xl font-bold">
          Create <Text className="text-primary">T3</Text> Turbo
        </Text>

        <MobileAuth />

        <View className="py-2">
          <Text className="text-primary font-semibold italic">
            Press on a user
          </Text>
        </View>

        <LegendList
          data={userQuery.data ?? []}
          estimatedItemSize={20}
          ItemSeparatorComponent={() => <View className="h-2" />}
          keyExtractor={(item) => item.id}
          renderItem={(p) => (
            <UserCard
              onDelete={() => deleteUserMutation.mutate(p.item.id)}
              user={p.item}
            />
          )}
        />

        <CreateUser />
      </View>
    </SafeAreaView>
  );
}
