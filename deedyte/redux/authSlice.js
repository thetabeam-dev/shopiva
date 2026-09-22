import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { fetchCurrentUserOrStatus } from '../src/api/user';
import { resolveInitialAppRoute } from '../src/auth/onboarding';
import { hasVendorShop } from '../src/api/shop';
import {
  clearSession,
  getStoredActiveRole,
  getStoredAccessToken,
  getStoredPreAuthChoice,
  getStoredUser,
  saveActiveRole,
  savePreAuthChoice,
  saveSession,
} from '../src/auth/session';
import { setUnauthorized401Suppressed } from '../src/auth/unauthorized';
import { disconnectChatSocket } from '../src/socket/chatSocket';
import { clear_nested_nav } from './nested_nav';
import { clear_orderInfo } from './order';
import { clear_orderList } from './orders';
import { clear_disputeInfo } from './dispute';
import { clear_disputeList } from './disputes';
import { clear_returnInfo } from './return';
import { clear_returnList } from './returns';

/** @typedef {'loading' | 'signedOut' | 'signedIn'} AuthStatus */
/** @typedef {'customer' | 'vendor'} AppRole */

/**
 * @param {object | null | undefined} user
 * @returns {AppRole}
 */
function normalizeAppRole(value) {
  const role = String(value ?? '').trim().toLowerCase();
  if (
    role === 'vendor' ||
    role === 'entrepreneur' ||
    role === 'seller' ||
    role === 'merchant' ||
    role === 'shop_owner'
  ) {
    return 'vendor';
  }
  return 'customer';
}

/**
 * @param {object | null | undefined} user
 * @returns {boolean}
 */
function userHasVendorRole(user) {
  if (!user || typeof user !== 'object') return false;
  const u = /** @type {Record<string, unknown>} */ (user);
  const roleCandidates = [
    u.role,
    u.userRole,
    u.accountType,
    u.type,
    u.roleRaw,
    u?.raw && typeof u.raw === 'object' ? /** @type {Record<string, unknown>} */ (u.raw).role : undefined,
  ];
  for (const candidate of roleCandidates) {
    if (normalizeAppRole(candidate) === 'vendor') return true;
  }
  const roles = u.roles;
  if (Array.isArray(roles)) {
    return roles.some((r) => normalizeAppRole(r) === 'vendor');
  }
  return false;
}

/**
 * @param {object | null | undefined} user
 * @returns {AppRole}
 */
function defaultRoleFromUser(user) {
  return userHasVendorRole(user) ? 'vendor' : 'customer';
}

const initialState = {
  /** @type {AuthStatus} */
  status: 'loading',
  isAuthenticated: false,
  /** Browsing without an account — skips “Almost there” / profile gate. */
  isGuest: false,
  /** @type {AppRole} */
  activeRole: 'customer',
  preAuthSeen: false,
  loginSkipAllowed: true,
  /** @type {'home' | 'OnboardingProfile' | 'Shop-Onboarding'} */
  initialAppRoute: 'home',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    applySignedIn: (state, action) => {
      const { mergedUser, preferredRole, authenticated, forceHome, fromSignup, initialAppRoute } =
        action.payload;
      state.initialAppRoute =
        initialAppRoute ??
        (forceHome ? 'home' : fromSignup ? 'OnboardingProfile' : 'home');
      const vendorEligible = userHasVendorRole(mergedUser);
      const nextRole =
        preferredRole === 'customer'
          ? 'customer'
          : preferredRole === 'vendor'
            ? vendorEligible
              ? 'vendor'
              : 'customer'
            : defaultRoleFromUser(mergedUser);
      state.activeRole = nextRole;
      state.isAuthenticated = authenticated;
      state.isGuest = false;
      state.status = 'signedIn';
    },
    setSignedOut: (state) => {
      state.initialAppRoute = 'home';
      state.activeRole = 'customer';
      state.isAuthenticated = false;
      state.isGuest = false;
      state.status = 'signedOut';
    },
    setGuestSignedIn: (state) => {
      state.initialAppRoute = 'home';
      state.activeRole = 'customer';
      state.preAuthSeen = true;
      state.loginSkipAllowed = true;
      state.isAuthenticated = false;
      state.isGuest = true;
      state.status = 'signedIn';
    },
    setPreAuthBootstrap: (state, action) => {
      const { preAuthSeen, loginSkipAllowed } = action.payload;
      state.preAuthSeen = preAuthSeen;
      state.loginSkipAllowed = loginSkipAllowed;
      state.isAuthenticated = false;
      state.isGuest = false;
      state.status = 'signedOut';
    },
    setPreAuthChoiceSync: (state, action) => {
      const normalized = action.payload === 'vendor' ? 'vendor' : 'customer';
      state.preAuthSeen = true;
      state.loginSkipAllowed = normalized !== 'vendor';
      state.activeRole = normalized;
    },
    setActiveRoleSync: (state, action) => {
      const next = action.payload === 'vendor' ? 'vendor' : 'customer';
      state.activeRole = next;
    },
  },
});

export const { applySignedIn, setSignedOut, setGuestSignedIn, setPreAuthBootstrap, setPreAuthChoiceSync, setActiveRoleSync } =
  authSlice.actions;

export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async (_, { dispatch, getState }) => {
  setUnauthorized401Suppressed(true);
  try {
    const token = await getStoredAccessToken();
    if (!token) {
      const preAuthChoice = await getStoredPreAuthChoice();
      dispatch(
        setPreAuthBootstrap({
          preAuthSeen: preAuthChoice === 'customer' || preAuthChoice === 'vendor',
          loginSkipAllowed: preAuthChoice !== 'vendor',
        }),
      );
      return;
    }
    const preferredRole = await getStoredActiveRole();
    const cached = await getStoredUser();
    const r = await fetchCurrentUserOrStatus();

    if (r.status === 401) {
      await clearSession();
      dispatch(setSignedOut());
      return;
    }

    if (r.user && typeof r.user === 'object') {
      await saveSession(token, r.user);
      const preAuthChoice = await getStoredPreAuthChoice();
      const initialAppRoute = await resolveInitialAppRoute(r.user, {
        fromSignup: false,
        preferredRole,
        preAuthChoice,
      });
      dispatch(
        applySignedIn({
          mergedUser: r.user,
          preferredRole,
          authenticated: true,
          forceHome: false,
          fromSignup: false,
          initialAppRoute,
        }),
      );
      await saveActiveRole(getState().auth.activeRole);
      return;
    }

    if (cached && typeof cached === 'object') {
      const preAuthChoice = await getStoredPreAuthChoice();
      const initialAppRoute = await resolveInitialAppRoute(cached, {
        fromSignup: false,
        preferredRole,
        preAuthChoice,
      });
      dispatch(
        applySignedIn({
          mergedUser: cached,
          preferredRole,
          authenticated: true,
          forceHome: false,
          fromSignup: false,
          initialAppRoute,
        }),
      );
      await saveActiveRole(getState().auth.activeRole);
      return;
    }

    if (r.ok) {
      await saveSession(token, {});
      const preAuthChoice = await getStoredPreAuthChoice();
      const initialAppRoute = await resolveInitialAppRoute({}, {
        fromSignup: false,
        preferredRole,
        preAuthChoice,
      });
      dispatch(
        applySignedIn({
          mergedUser: {},
          preferredRole,
          authenticated: true,
          forceHome: false,
          fromSignup: false,
          initialAppRoute,
        }),
      );
      await saveActiveRole(getState().auth.activeRole);
      return;
    }

    await saveSession(token, {});
    const preAuthChoice = await getStoredPreAuthChoice();
    const initialAppRoute = await resolveInitialAppRoute({}, {
      fromSignup: false,
      preferredRole,
      preAuthChoice,
    });
    dispatch(
      applySignedIn({
        mergedUser: {},
        preferredRole,
        authenticated: true,
        forceHome: false,
        fromSignup: false,
        initialAppRoute,
      }),
    );
    await saveActiveRole(getState().auth.activeRole);
  } finally {
    setUnauthorized401Suppressed(false);
  }
});

export const signInThunk = createAsyncThunk(
  'auth/signIn',
  async ({ token, partialUser, options = {} }, { dispatch, getState }) => {
    setUnauthorized401Suppressed(true);
    try {
      const forceHome = Boolean(options?.forceHome);
      const fromSignup = Boolean(options?.fromSignup);
      const preferredRole = await getStoredActiveRole();
      const preAuthChoice = await getStoredPreAuthChoice();
      // Alert.alert(JSON.stringify(preferredRole))
      await saveSession(token, partialUser ?? null);
      let merged =
        partialUser && typeof partialUser === 'object'
          ? { ...partialUser }
          : null;

      const r = await fetchCurrentUserOrStatus();
      if (r.status === 401) {
        await clearSession();
        dispatch(setSignedOut());
        return;
      }
      if (r.user && typeof r.user === 'object') {
        merged = { ...merged, ...r.user };
        await saveSession(token, merged);
      } else if (!merged && !r.ok) {
        const cached = await getStoredUser();
        if (cached && typeof cached === 'object') {
          merged = { ...cached };
        }
      }

      if (!merged || typeof merged !== 'object') {
        merged = {};
        await saveSession(token, merged);
      } else {
        await saveSession(token, merged);
      }

      dispatch(
        applySignedIn({
          mergedUser: merged,
          preferredRole,
          authenticated: true,
          forceHome,
          fromSignup,
          initialAppRoute: forceHome
            ? 'home'
            : await resolveInitialAppRoute(merged, {
                fromSignup,
                preferredRole,
                preAuthChoice,
              }),
        }),
      );
      await saveActiveRole(getState().auth.activeRole);
    } finally {
      setUnauthorized401Suppressed(false);
    }
  },
);

export const signOutThunk = createAsyncThunk('auth/signOut', async (_, { dispatch }) => {
  setUnauthorized401Suppressed(true);
  try {
    await clearSession();
  } catch {
    // ignore
  } finally {
    try {
      disconnectChatSocket();
    } catch {
      // ignore
    }
    dispatch(clear_nested_nav());
    dispatch(clear_orderInfo());
    dispatch(clear_orderList());
    dispatch(clear_disputeInfo());
    dispatch(clear_disputeList());
    dispatch(clear_returnInfo());
    dispatch(clear_returnList());
    dispatch(setSignedOut());
    setUnauthorized401Suppressed(false);
  }
});

export const enterGuestModeThunk = createAsyncThunk('auth/enterGuest', async (_, { dispatch }) => {
  setUnauthorized401Suppressed(true);
  dispatch(setGuestSignedIn());
  try {
    await clearSession();
  } catch {
    // ignore
  }
  try {
    await saveActiveRole('customer');
  } catch {
    // best effort
  }
  try {
    await savePreAuthChoice('customer');
  } catch {
    // best effort
  } finally {
    setUnauthorized401Suppressed(false);
  }
});

export const setActiveRoleThunk = createAsyncThunk('auth/setActiveRole', async (role, { dispatch }) => {
  let next = 'customer';
  if (role === 'vendor') {
    const storedUser = await getStoredUser();
    if (userHasVendorRole(storedUser)) {
      next = 'vendor';
    } else {
      try {
        const hasShop = await hasVendorShop();
        if (hasShop) next = 'vendor';
      } catch {
        /* keep customer */
      }
    }
  }
  dispatch(setActiveRoleSync(next));
  await saveActiveRole(next);
  try {
    disconnectChatSocket();
  } catch {
    /* ignore */
  }
});

export const setPreAuthChoiceThunk = createAsyncThunk('auth/setPreAuthChoice', async (choice, { dispatch }) => {
  const normalized = choice === 'vendor' ? 'vendor' : 'customer';
  dispatch(setPreAuthChoiceSync(normalized));
  try {
    await saveActiveRole(normalized);
    await savePreAuthChoice(normalized);
  } catch {
    // best effort
  }
});

export default authSlice.reducer;
