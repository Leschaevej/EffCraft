import Pusher from "pusher";

const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export async function notifyClients(event: { type: string; data: Record<string, unknown> }) {
  try {
    await pusherServer.trigger("effcraft-channel", event.type, event.data);
  } catch (error) {
    console.error('[Pusher Server] Erreur envoi:', error);
  }
}

export default pusherServer;
