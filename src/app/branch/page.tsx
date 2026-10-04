import { redirect } from "next/navigation";
import { pagePath } from "@/lib/nav";

export default function BranchIndex() {
  redirect(pagePath({ path: "/branch" }, "log"));
}
