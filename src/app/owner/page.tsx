import { redirect } from "next/navigation";
import { pagePath } from "@/lib/nav";

export default function OwnerIndex() {
  redirect(pagePath({ path: "/owner" }, "overview"));
}
