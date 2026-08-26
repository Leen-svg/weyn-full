import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { Wordmark } from '@/components/Wordmark';
import { useAuth } from '@/lib/auth';
import { colors, fonts, type, androidTextFix } from '@/theme';

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      router.replace('/(tabs)/find');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign you in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <View style={styles.header}>
          <Wordmark size={30} />
          <Text style={[type.eyebrow, androidTextFix, styles.eyebrow]}>Welcome back</Text>
          <Text style={[type.h1, androidTextFix]}>Where to?</Text>
          <Text style={[type.lead, androidTextFix, styles.sub]}>
            Sign in to save spots, start a vote, and keep your points.
          </Text>
        </View>

        {error ? <Notice tone="error">{error}</Notice> : null}

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          placeholder="••••••••"
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        <Button
          label="Sign in"
          variant="primary"
          block
          loading={busy}
          disabled={!email || !password}
          onPress={submit}
        />

        <View style={styles.links}>
          <Link href="/(auth)/forgot-password" style={styles.link}>
            Forgot password?
          </Link>
          <Link href="/(auth)/sign-up" style={styles.link}>
            Create an account
          </Link>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  header: { marginBottom: 26, gap: 4 },
  eyebrow: { marginTop: 18 },
  sub: { marginTop: 6 },
  links: { marginTop: 22, gap: 12, alignItems: 'flex-start' },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.blueDeep },
});
