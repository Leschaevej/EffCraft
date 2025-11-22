import { useEffect } from 'react';
import Pusher from 'pusher-js';

let pusherInstance: Pusher | null = null;

function getPusherInstance() {
  if (!pusherInstance) {
    pusherInstance = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });
  }
  return pusherInstance;
}

export function usePusher(
  eventType: string,
  callback: (data: any) => void
) {
  useEffect(() => {
    const pusher = getPusherInstance();
    const channel = pusher.subscribe('effcraft-channel');

    channel.bind(eventType, callback);

    return () => {
      channel.unbind(eventType, callback);
    };
  }, [eventType, callback]);
}
