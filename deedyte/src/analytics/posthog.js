import PostHog from 'posthog-react-native';

export const posthog = new PostHog('phc_qYgwSAhiFJLUMkrkHqLZmk3Km4UXVjywLPaFMnSsn2BX', {
  host: 'https://us.i.posthog.com',
  persistence: 'memory',
  captureAppLifecycleEvents: false,
});
