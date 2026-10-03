import { redirect } from "next/navigation";

/** @deprecated Use global `/terms-of-use` */
export default function TermsOfUseRedirect() {
  redirect("/terms-of-use");
}
