import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  enterGuestModeThunk,
  setActiveRoleThunk,
  setPreAuthChoiceThunk,
  signInThunk,
  signOutThunk,
} from '../../redux/authSlice';

export function useAuth() {
  const dispatch = useDispatch();
  const auth = useSelector((s) => s.auth);

  const signIn = useCallback(
    (token, partialUser, options) =>
      dispatch(signInThunk({ token, partialUser, options: options ?? {} })).unwrap(),
    [dispatch],
  );

  const signOut = useCallback(() => dispatch(signOutThunk()).unwrap(), [dispatch]);

  const enterGuestMode = useCallback(() => dispatch(enterGuestModeThunk()).unwrap(), [dispatch]);

  const setActiveRole = useCallback(
    (role) => dispatch(setActiveRoleThunk(role)).unwrap(),
    [dispatch],
  );

  const setPreAuthChoice = useCallback(
    (choice) => dispatch(setPreAuthChoiceThunk(choice)).unwrap(),
    [dispatch],
  );

  return useMemo(
    () => ({
      ...auth,
      signIn,
      signOut,
      enterGuestMode,
      setActiveRole,
      setPreAuthChoice,
    }),
    [auth, signIn, signOut, enterGuestMode, setActiveRole, setPreAuthChoice],
  );
}
