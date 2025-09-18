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
  const roomRef = useRef<Room | null>(null);
  const localAudioTrackRef = useRef<any>(null);
  const [micOn, setMicOn] = useState<boolean>(true);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [roomName, setRoomName] = useState<string | null>(null);
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
      const onParticipantConnected = (participant: RemoteParticipant) => {
        console.log("👤 Participant connected:", participant.identity);
        setParticipants((p) => [...p, participant]);
        setParticipantCount((c) => c + 1);
      };

      const onParticipantDisconnected = (participant: RemoteParticipant) => {
        console.log("👤 Participant disconnected:", participant.identity);
        setParticipants((p) => p.filter((pp) => pp.sid !== participant.sid));
        setParticipantCount((c) => Math.max(0, c - 1));
      };

      room.on("participantConnected", onParticipantConnected);
      room.on("participantDisconnected", onParticipantDisconnected);

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

        setRoomName(room.name ?? null);

        try {
          const anyRoom = room as any;
          let initial: RemoteParticipant[] = [];
          const mapsToTry = ["participants", "remoteParticipants", "participantMap"];
          for (const key of mapsToTry) {
            const map = anyRoom[key];
            if (map && typeof map.values === "function") {
              initial = Array.from(map.values());
              break;
            }
          }
          if (initial.length === 0 && typeof anyRoom.getRemoteParticipants === "function") {
            try {
              const res = anyRoom.getRemoteParticipants();
              if (Array.isArray(res)) initial = res as RemoteParticipant[];
            } catch {}
          }

          if (initial.length > 0) {
            setParticipants(initial as RemoteParticipant[]);
            setParticipantCount(initial.length + 1);
          } else if (typeof anyRoom.numParticipants === "number") {
            setParticipantCount(anyRoom.numParticipants);
          } else {
            setParticipantCount(1);
          }
        } catch (e) {
          console.debug("Could not read initial participants map", e);
        }

        const localTrack = await createLocalAudioTrack();
        localAudioTrackRef.current = localTrack;
        await room.localParticipant.publishTrack(localTrack);
        console.log("🎤 Local audio track published");

        try {
          const identity = (room.localParticipant as any)?.identity ?? null;
          if (identity) {
            const es = new EventSource(`${process.env.NEXT_PUBLIC_SERVER_URL}/subscribe-transfer/${encodeURIComponent(identity)}`);
            es.addEventListener("transfer", (ev: MessageEvent) => {
              try {
                const payload = JSON.parse((ev as any).data);
                const token = payload.token;
                if (token) {
                  window.location.href = `/call/${token}`;
                }
              } catch (e) {
                console.error("Failed to parse transfer SSE payload", e);
              }
            });
            (roomRef.current as any).__sse = es;
          }
        } catch (e) {
          console.warn("Could not open SSE for transfers", e);
        }
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

  function toggleMic() {
    const t = localAudioTrackRef.current;
    if (!t) return;

    const media = (t as any).mediaStreamTrack;
    if (media && typeof media.enabled === "boolean") {
      media.enabled = !media.enabled;
      setMicOn(media.enabled);
      return;
    }

    if (typeof t.setEnabled === "function") {
      t.setEnabled(!micOn);
      setMicOn(!micOn);
    }
  }

  function handleExit() {
    roomRef.current?.disconnect();
    router.push("/");
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-6 bg-white/60 backdrop-blur rounded-lg shadow-md">
        <h1 className="text-2xl font-semibold mb-2">LiveKit Room</h1>
        <p className="text-sm text-gray-700 mb-4">Joined room: {roomName ?? "—"}</p>
        <p className="text-sm text-gray-600 mb-2">Connected — waiting for remote audio.</p>
        <div className="mb-4 text-sm text-gray-700">
          <div className="font-medium">Participants: {participantCount ?? participants.length}</div>
          <ul className="list-disc list-inside mt-2">
            {participants.map((p) => (
              <li key={p.sid}>{p.identity ?? p.name ?? p.sid}</li>
            ))}
          </ul>
        </div>

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
