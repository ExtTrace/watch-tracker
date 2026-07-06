export async function sendDiscordNotification(
  webhookUrl: string,
  message: string,
): Promise<void> {
  if (!webhookUrl) return;

  // Discord webhooks use 'content' for the main message body.
  // We remove HTML tags because Discord uses markdown instead of HTML.
  const discordMessage = message
    .replace(/<b>(.*?)<\/b>/g, '**$1**')
    .replace(/<a href="(.*?)">(.*?)<\/a>/g, '[$2]($1)');

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: discordMessage,
      username: 'Ext Tracker Bot',
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord API Error: ${response.status} ${response.statusText}`);
  }
}
