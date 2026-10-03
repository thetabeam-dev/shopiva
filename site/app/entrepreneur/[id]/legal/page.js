import { redirect } from "next/navigation";

/** @deprecated Use global `/legal` */
export default function LegalRedirect() {
  redirect("/legal");
}
