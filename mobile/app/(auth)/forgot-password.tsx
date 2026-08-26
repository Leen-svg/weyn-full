import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Field } from '@/components/Field';
import { Button } from '@/components/Button';
import { Notice } from '@/components/Notice';
import { useAuth } from '@/lib/auth';
import { colors, fonts, type, androidTextFix } from '@/theme';

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the reset link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={[type.eyebrow, androidTextFix]}>Reset</Text>
        <Text style={[type.h1, androidTextFix]}>Forgot password</Text>
      </View>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {sent ? (
        <Notice>
          If that email has an account, a reset link is on its way. Open it on
          this phone.
        </Notice>
      ) : null}

      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
      />

      <Button
        label="Send reset link"
        variant="primary"
        block
        loading={busy}
        disabled={!email}
        onPress={submit}
      />

      <Link href="/(auth)/sign-in" style={styles.link}>
        Back to sign in
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: 26, gap: 4, marginTop: 18 },
  link: { marginTop: 22, fontFamily: fonts.bodyBold, fontSize: 14, color: colors.blueDeep },
});
