import * as SecureStore from 'expo-secure-store';

/**
 * SecureStore refuses values over 2048 bytes, and a Supabase session
 * (access token + refresh token + user object) is routinely larger than
 * that, so storing it whole silently fails and the user is logged out on
 * every cold start. We split the value across numbered keys instead.
 *
 * Layout:  <key>      -> the chunk count, e.g. "3"
 *          <key>.0    -> first 1800 bytes
 *          <key>.1    -> next 1800 bytes, ...
 */
const CHUNK_SIZE = 1800;

function chunkKey(key: string, index: number) {
  return `${key}.${index}`;
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const header = await SecureStore.getItemAsync(key);
      if (header === null) return null;

      const count = Number(header);
      if (!Number.isInteger(count) || count < 1) return null;

      const parts = await Promise.all(
        Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i)))
      );
      // A partially written record is unusable — treat it as absent rather
      // than handing Supabase a truncated JSON blob it will throw on.
      if (parts.some((part) => part === null)) {
        await secureStorage.removeItem(key);
        return null;
      }
      return parts.join('');
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    // Clear first: a shorter session must not leave stale trailing chunks
    // that a later, longer read would splice back in.
    await secureStorage.removeItem(key);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await Promise.all(chunks.map((chunk, i) => SecureStore.setItemAsync(chunkKey(key, i), chunk)));
    await SecureStore.setItemAsync(key, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    try {
      const header = await SecureStore.getItemAsync(key);
      const count = Number(header);
      if (Number.isInteger(count) && count > 0) {
        await Promise.all(
          Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i)))
        );
      }
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Nothing to remove.
    }
  },
};
