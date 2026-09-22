import { useEffect, useLayoutEffect } from 'react';
import { useDispatch } from 'react-redux';
import { bootstrapAuth, signInThunk, signOutThunk } from '../../redux/authSlice';
import { registerAuthSignInHandler } from './authBridge';
import { setUnauthorizedHandler } from './unauthorized';

/**
 * Runs auth cold bootstrap and wires global sign-in / 401 handlers.
 * Must render inside Redux `<Provider>`.
 */
export default function AuthBootstrap() {
  const dispatch = useDispatch();

  useEffect(() => {
    void dispatch(bootstrapAuth());
  }, [dispatch]);

  useLayoutEffect(() => {
    registerAuthSignInHandler((token, user, opts) =>
      dispatch(signInThunk({ token, user, options: opts ?? {} })).unwrap(),
    );
    return () => registerAuthSignInHandler(null);
  }, [dispatch]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      void dispatch(signOutThunk());
    });
    return () => setUnauthorizedHandler(null);
  }, [dispatch]);

  return null;
}
