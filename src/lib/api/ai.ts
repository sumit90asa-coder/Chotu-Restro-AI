import { apiFetch } from "./client";

export interface AIChatResponse {
  reply: string;
  intent?: string;
  suggested_action?: string;
  action_data?: Record<string, any>;
  action_taken?: {
    action: string;
    table_id?: string;
    items?: Array<{ name: string; quantity: number }>;
    status?: string;
  };
  data_context?: Record<string, any>;
}

function getActiveRestaurantId(): string {
  if (typeof window !== "undefined") {
    try {
      const sess = localStorage.getItem("chotu_user_session");
      if (sess) {
        const parsed = JSON.parse(sess);
        if (parsed.restaurantId) return parsed.restaurantId;
      }
    } catch {
      // fallback
    }
  }
  return "default";
}

export async function askChotu(message: string, restaurantId?: string): Promise<AIChatResponse> {
  const targetId = restaurantId || getActiveRestaurantId();
  return await apiFetch<AIChatResponse>("/ai/chat", {
    method: "POST",
    body: JSON.stringify({
      message,
      restaurant_id: targetId,
    }),
  });
}
