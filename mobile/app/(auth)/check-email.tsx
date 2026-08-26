import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { type, androidTextFix } from '@/theme';

export default function CheckEmail() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.wrap}>
        <Card tone="sky" tilt>
          <Text style={[type.h2, androidTextFix]}>Check your email</Text>
          <Text style={[type.body, androidTextFix, styles.body]}>
            We sent a confirmation link{email ? ` to ${email}` : ''}. Open it on
            this phone and it will bring you straight back into the app.
          </Text>
        </Card>

        <Button
          label="Back to sign in"
          block
          style={styles.button}
          onPress={() => router.replace('/(auth)/sign-in')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingVertical: 40 },
  body: { marginTop: 10 },
  button: { marginTop: 24 },
});
