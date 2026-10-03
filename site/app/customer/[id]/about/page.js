import { redirect } from "next/navigation";

/** @deprecated Use global `/about` */
export default function AboutRedirect() {
  redirect("/about");
}
