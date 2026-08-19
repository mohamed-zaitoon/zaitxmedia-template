import { GET as handleWebhookGet, POST as handleWebhookPost } from "./webhook/route";

export async function GET() {
  return handleWebhookGet();
}

export async function POST(request: Request) {
  return handleWebhookPost(request);
}
