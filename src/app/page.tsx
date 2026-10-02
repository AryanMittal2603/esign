import { redirect } from "next/navigation";

// The middleware sends phones to /sign and desktops to /admin; this is only a fallback.
export default function Home() {
  redirect("/admin");
}
