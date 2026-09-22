import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  fetchCurrentUser,
  updateUserEmail,
  updateUserPassword,
  updateUserPhone,
  updateUserProfileFields,
} from '../api/user';
import { getStoredAccessToken, getStoredUser, saveSession } from '../auth/session';
import { normalizeUser } from '../profile/normalizeUser';

/** @typedef {ReturnType<typeof normalizeUser>} NormalizedUser */

const ProfileContext = createContext(
  /** @type {{
   *   user: NormalizedUser | null;
   *   loading: boolean;
   *   error: string | null;
   *   refresh: () => Promise<void>;
   *   mergeRemoteUser: (raw: object) => Promise<void>;
 *   savePhone: (phone: string) => Promise<{ ok: boolean; message?: string }>;
 *   saveEmail: (email: string) => Promise<{ ok: boolean; message?: string }>;
 *   savePassword: (newPassword: string) => Promise<{ ok: boolean; message?: string }>;
 *   saveProfileFields: (fields: { fname?: string; lname?: string; gender?: string; location?: { city?: string; state?: string; country?: string } }) => Promise<{ ok: boolean; message?: string }>;
   * }} */ (null),
);

export function ProfileProvider({ children }) {
  const [user, setUser] = useState(/** @type {NormalizedUser | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  const mergeRemoteUser = useCallback(async (raw) => {
    const token = await getStoredAccessToken();
    if (!token || !raw || typeof raw !== 'object') return;
    await saveSession(token, raw);
    setUser(normalizeUser(/** @type {Record<string, unknown>} */ (raw)));
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    const token = await getStoredAccessToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const remote = await fetchCurrentUser();
      if (remote && typeof remote === 'object') {
        await saveSession(token, remote);
        setUser(normalizeUser(/** @type {Record<string, unknown>} */ (remote)));
      } else {
        const cached = await getStoredUser();
        setUser(cached && typeof cached === 'object' ? normalizeUser(/** @type {Record<string, unknown>} */ (cached)) : null);
      }
    } catch (e) {
      try {
        const cached = await getStoredUser();
        setUser(cached && typeof cached === 'object' ? normalizeUser(/** @type {Record<string, unknown>} */ (cached)) : null);
      } catch {
        setUser(null);
      }
      setError(e instanceof Error ? e.message : 'Could not refresh profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const savePhone = useCallback(
    async (phone) => {
      const uid = user?.id;
      if (!uid) return { ok: false, message: 'Not signed in.' };
      const out = await updateUserPhone(uid, phone);
      if (out.ok && out.user) {
        await mergeRemoteUser(out.user);
      } else if (out.ok) {
        await refresh();
      }
      return out.ok ? { ok: true } : { ok: false, message: out.message };
    },
    [user?.id, mergeRemoteUser, refresh],
  );

  const saveEmail = useCallback(
    async (email) => {
      const uid = user?.id;
      if (!uid) return { ok: false, message: 'Not signed in.' };
      const out = await updateUserEmail(uid, email);
      if (out.ok && out.user) {
        await mergeRemoteUser(out.user);
      } else if (out.ok) {
        await refresh();
      }
      return out.ok ? { ok: true } : { ok: false, message: out.message };
    },
    [user?.id, mergeRemoteUser, refresh],
  );

  const savePassword = useCallback(
    async (newPassword) => {
      const uid = user?.id;
      if (!uid) return { ok: false, message: 'Not signed in.' };
      const out = await updateUserPassword(uid, newPassword);
      if (out.ok) {
        await refresh();
      }
      return out.ok ? { ok: true } : { ok: false, message: out.message };
    },
    [user?.id, refresh],
  );

  const saveProfileFields = useCallback(
    async (fields) => {
      const uid = user?.id;
      if (!uid) return { ok: false, message: 'Not signed in.' };
      const out = await updateUserProfileFields(uid, fields);
      if (out.ok && out.user) {
        await mergeRemoteUser(out.user);
      } else if (out.ok) {
        await refresh();
      }
      return out.ok ? { ok: true } : { ok: false, message: out.message };
    },
    [user?.id, mergeRemoteUser, refresh],
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      refresh,
      mergeRemoteUser,
      savePhone,
      saveEmail,
      savePassword,
      saveProfileFields,
    }),
    [user, loading, error, refresh, mergeRemoteUser, savePhone, saveEmail, savePassword, saveProfileFields],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return ctx;
}
