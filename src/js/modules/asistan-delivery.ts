import { LogCategory } from "@shared/logging-core";
import { showPage } from "../app/navigation.js";
import { Logger } from "./logger/index.js";

export interface AsistanDeliveryRequest {
  message: string;
  page?: string;
  metadata?: Record<string, unknown>;
}

export interface AsistanDeliveryResult {
  success: boolean;
  message?: string;
}

type AsistanDeliveryHandler = (
  request: AsistanDeliveryRequest
) => Promise<AsistanDeliveryResult>;

let activeAsistanDeliveryHandler: AsistanDeliveryHandler | null = null;

export function registerAsistanDeliveryHandler(handler: AsistanDeliveryHandler | null): void {
  activeAsistanDeliveryHandler = handler;
}

export async function deliverToAsistan(
  request: AsistanDeliveryRequest
): Promise<AsistanDeliveryResult> {
  showPage("asistan");

  if (activeAsistanDeliveryHandler === null) {
    return {
      success: false,
      message: "Asistan teslim handler'i hazir degil",
    };
  }

  Logger.info(LogCategory.ASISTAN_CORE, "Asistan delivery requested", {
    page: request.page ?? "generic",
  });

  return await activeAsistanDeliveryHandler(request);
}
