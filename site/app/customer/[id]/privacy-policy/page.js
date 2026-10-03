import { redirect } from "next/navigation";

/** @deprecated Use global `/privacy-policy` */
export default function PrivacyPolicyRedirect() {
  redirect("/privacy-policy");
}
