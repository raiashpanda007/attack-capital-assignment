"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
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
  const router = useRouter();
  // refs and state for UI controls (kept minimal to avoid changing LiveKit logic)
  const roomRef = useRef<Room | null>(null);
  const localAudioTrackRef = useRef<any>(null);
  const [micOn, setMicOn] = useState<boolean>(true);
  const [roomName, setRoomName] = useState<string | null>(null);
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
    roomRef.current = room;
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

        // show the room name in UI
        setRoomName(room.name ?? null);

        // ✅ Publish local audio so others can hear you
        const localTrack = await createLocalAudioTrack();
        // store reference so UI can toggle mic
        localAudioTrackRef.current = localTrack;
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
      roomRef.current?.disconnect();
      setRoomName(null);
    };
  }, [token]);

  // Toggle microphone by enabling/disabling the underlying MediaStreamTrack if available.
  function toggleMic() {
    const t = localAudioTrackRef.current;
    if (!t) return;

    // livekit LocalTrack exposes mediaStreamTrack in many builds
    const media = (t as any).mediaStreamTrack;
    if (media && typeof media.enabled === "boolean") {
      media.enabled = !media.enabled;
      setMicOn(media.enabled);
      return;
    }

    // Fallback: some track implementations have setEnabled
    if (typeof t.setEnabled === "function") {
      t.setEnabled(!micOn);
      setMicOn(!micOn);
    }
  }

  // Exit the room and navigate to root
  function handleExit() {
    roomRef.current?.disconnect();
    router.push("/");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-6 bg-white/60 backdrop-blur rounded-lg shadow-md">
        <h1 className="text-2xl font-semibold mb-2">LiveKit Room</h1>
        <p className="text-sm text-gray-700 mb-4">Joined room: {roomName ?? "—"}</p>
        <p className="text-sm text-gray-600 mb-4">Connected — waiting for remote audio.</p>

        <div className="flex gap-3">
          <button
            onClick={() => toggleMic()}
            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {micOn ? "Mute" : "Unmute"}
          </button>

          <button
            onClick={() => handleExit()}
            className="flex-1 py-2 px-4 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Helpers and outer refs/state ---
// Keep these outside the component logic to avoid changing LiveKit behavior in the effect
