import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { useAuth } from '@/lib/auth';
import { colors, fonts, type, androidTextFix } from '@/theme';

export default function SignUp() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const { needsConfirmation } = await signUp(email, password);
      if (needsConfirmation) {
        router.replace({ pathname: '/(auth)/check-email', params: { email: email.trim() } });
      } else {
        router.replace('/(tabs)/find');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account.');
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
          <Text style={[type.eyebrow, androidTextFix]}>Join Weyn</Text>
          <Text style={[type.h1, androidTextFix]}>Make an account</Text>
          <Text style={[type.lead, androidTextFix, styles.sub]}>
            You need one to save spots and earn points. Voting on someone
            else&apos;s link never will.
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
          hint="At least 8 characters."
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="••••••••"
        />

        <Button
          label="Create account"
          variant="primary"
          block
          loading={busy}
          disabled={!email || password.length < 8}
          onPress={submit}
        />

        <Link href="/(auth)/sign-in" style={styles.link}>
          I already have an account
        </Link>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  header: { marginBottom: 26, gap: 4, marginTop: 18 },
  sub: { marginTop: 6 },
  link: { marginTop: 22, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.blueDeep },
});
