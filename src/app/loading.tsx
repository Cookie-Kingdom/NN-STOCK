import { LoadingScreen } from "@/components/molecules/LoadingState";

/* Shown while a route's JavaScript is still on the way (first visit, slow network).
 * Without it the browser holds the previous page — or a blank one — with nothing
 * saying the app is working. */
export default function Loading() {
  return <LoadingScreen message="กำลังเปิดระบบ…" />;
}
