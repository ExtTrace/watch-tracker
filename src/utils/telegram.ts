import { WT_API_URL } from "../config/env";

export async function sendTelegramNotification(
  chatId: string,
  message: string,
): Promise<void> {
  const url = `${WT_API_URL}/api/notify`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chatId,
      message,
    }),
  });

  if (!response.ok) {
    throw new Error(`WT API Error: ${response.status} ${response.statusText}`);
  }
}
