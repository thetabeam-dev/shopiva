import OAuthCallbackClient from "./OAuthCallbackClient";

export const metadata = {
  title: "Signing in | DeeDyte",
  robots: { index: false, follow: false },
};

export default function OAuthCallbackPage() {
  return <OAuthCallbackClient />;
}
