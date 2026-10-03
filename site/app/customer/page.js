import { redirect } from "next/navigation";

/** @deprecated Customer home now lives at `/` */
export default function CustomerIndexRedirect() {
  redirect("/");
}
