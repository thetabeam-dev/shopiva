import { redirect } from "next/navigation";

export default async function LegacyProductRedirect({ params }) {
  const resolved = params && typeof params.then === "function" ? await params : params;
  const id = typeof resolved?.id === "string" ? resolved.id : String(resolved?.id ?? "");
  redirect(`/${id || ""}`);
}
