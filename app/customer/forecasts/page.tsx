import { redirect } from "next/navigation";

/**
 * 旧「运单预报」列表已合并至「我的运单」，此处永久重定向。
 */
export default function CustomerForecastsRedirectPage(): never {
  redirect("/customer/shipments");
}
