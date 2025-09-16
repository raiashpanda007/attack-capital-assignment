"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Room,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  Track,
  createLocalAudioTrack,
} from "livekit-client";

export default function LiveKitRoom() {
  const params = useParams();
  // ✅ Handle token being a string or string[]
  const tokenParam = params?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!token || !url) {
      console.error("❌ Missing token or LiveKit URL");
      return;
    }

    const room = new Room();
    const attachedAudioElements: HTMLMediaElement[] = [];

    async function joinRoom() {
      room.on("participantConnected", (participant: RemoteParticipant) => {
        console.log("👤 Participant connected:", participant.identity);
      });

      room.on(
        "trackSubscribed",
        (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
          console.log(`🎧 Track subscribed: ${track.kind} from ${participant.identity}`);

          if (track.kind === Track.Kind.Audio) {
            const audioEl = track.attach();
            audioEl.autoplay = true;
            (audioEl as HTMLMediaElement & { playsInline?: boolean }).playsInline = true;
            document.body.appendChild(audioEl);
            attachedAudioElements.push(audioEl);
          }
        }
      );

      try {
        await room.connect(url as string, token as string);
        console.log("✅ Connected to LiveKit room:", room.name);

        // ✅ Publish local audio so others can hear you
        const localTrack = await createLocalAudioTrack();
        await room.localParticipant.publishTrack(localTrack);
        console.log("🎤 Local audio track published");
      } catch (error) {
        console.error("❌ Failed to connect:", error);
      }
    }

    joinRoom();

    return () => {
      console.log("🔌 Cleaning up LiveKit connection...");
      attachedAudioElements.forEach((el) => el.remove());
      room.disconnect();
    };
  }, [token]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-xl font-bold">LiveKit Room</h1>
      <p className="text-gray-500">Waiting for remote audio...</p>
    </div>
  );
}
