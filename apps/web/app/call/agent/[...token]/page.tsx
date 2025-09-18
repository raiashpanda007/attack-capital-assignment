"use client";

import { useEffect, useState, useRef } from "react";
import axios from "axios";
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
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [participantCount, setParticipantCount] = useState<number>(0);
  const [warmStarted, setWarmStarted] = useState<boolean>(false);
  const [supportToken, setSupportToken] = useState<string | null>(null);
  const [supportRoomName, setSupportRoomName] = useState<string | null>(null);
  const [transferLink, setTransferLink] = useState<string | null>(null);
  const [starting, setStarting] = useState<boolean>(false);
  const [completing, setCompleting] = useState<boolean>(false);
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

    // declare handlers in outer scope so cleanup can remove them
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

    async function joinRoom() {
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

        // show the room name in UI
        setRoomName(room.name ?? null);

        // subscribe to room-level SSE so this agent sees warm transfer start events
        try {
          const baseRoom = room.name ? (room.name as string).replace(/-main-room$|-support-room$/, "") : null;
          if (baseRoom) {
            const es = new EventSource(`${process.env.NEXT_PUBLIC_SERVER_URL}/subscribe-room/${encodeURIComponent(baseRoom)}`);
            es.addEventListener("room_event", (ev: MessageEvent) => {
              try {
                const payload = JSON.parse((ev as any).data);
                if (payload?.type === "warm_started") {
                  setWarmStarted(true);
                  if (payload?.supportRoom) setSupportRoomName(payload.supportRoom);
                }
              } catch (e) {
                console.error("Failed to parse room_event SSE payload", e);
              }
            });
            (roomRef.current as any).__roomSse = es;
          }
        } catch (e) {
          console.warn("Could not open room SSE for warm events", e);
        }

        // populate initial participants list (use any-cast to avoid strict SDK typing differences)
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
            setParticipantCount(initial.length + 1); // include self
          } else if (typeof anyRoom.numParticipants === "number") {
            setParticipantCount(anyRoom.numParticipants);
          } else {
            // default to 1 (self) if nothing else available
            setParticipantCount(1);
          }
        } catch (e) {
          // ignore if participants map isn't available on this build
          console.debug("Could not read initial participants map", e);
        }

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
      // remove listeners and disconnect
      if (roomRef.current) {
        try {
          (roomRef.current as any).off?.("participantConnected", onParticipantConnected);
          (roomRef.current as any).off?.("participantDisconnected", onParticipantDisconnected);
        } catch (e) {
          // ignore if off isn't available
        }
        roomRef.current.disconnect();
      }
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

  function handleAddWarmTransfer() {
    // Start warm transfer from agent's in-call screen.
    (async () => {
      if (starting) return;
      setStarting(true);
      // optimistically switch UI so agent sees Complete Transfer immediately
      setWarmStarted(true);
      try {
        const body = {
          roomName: roomName ? roomName.replace(/-main-room$|-support-room$/, "") : "test",
          agentIdentity: (roomRef.current as any)?.localParticipant?.identity ?? "Agent 1",
        };
        const resp = await axios.post(`${process.env.NEXT_PUBLIC_SERVER_URL}/start-warm-transfer`, body);
        const data = resp.data?.data;
        const token = data?.token;
        const supportRoom = data?.supportRoom ?? data?.room ?? null;
        const already = data?.alreadyStarted ?? false;
        if (!token) {
          console.error("No support token returned for warm transfer", resp.data);
          // revert optimistic UI
          setWarmStarted(false);
          setStarting(false);
          return;
        }

        // Remember support-room info
        setSupportToken(token);
        setSupportRoomName(supportRoom);

        // If server indicated this was newly started, open the support room tab for the requester.
        if (!already) {
          // Mute local audio track if we have one (stay connected but muted)
          const t = localAudioTrackRef.current as any;
          try {
            const media = t?.mediaStreamTrack;
            if (media && typeof media.enabled === "boolean") {
              media.enabled = false;
              setMicOn(false);
            } else if (typeof t?.setEnabled === "function") {
              t.setEnabled(false);
              setMicOn(false);
            }
          } catch (muteErr) {
            console.warn("Failed to mute local audio track:", muteErr);
          }

          // Open the support-room in a new tab so the agent can prep there while remaining
          // connected (and muted) in the current main room.
          const supportUrl = `${window.location.origin}/call/agent/${token}`;
          window.open(supportUrl, "_blank");
        }
      } catch (err) {
        console.error("Failed to start warm transfer:", err);
        setWarmStarted(false);
      } finally {
        setStarting(false);
      }
    })();
  }

  async function handleCompleteTransfer() {
    if (!warmStarted || !supportRoomName) {
      alert("Start a warm transfer first");
      return;
    }
    if (completing) return;
    setCompleting(true);
    try {
      const body = { roomName: roomName ? roomName.replace(/-main-room$|-support-room$/, "") : "test" };
      const resp = await axios.post(`${process.env.NEXT_PUBLIC_SERVER_URL}/complete-transfer`, body);
      const data = resp.data?.data;
      const userToken = data?.token;
      if (!userToken) {
        console.error("No user token returned for transfer completion", resp.data);
        setCompleting(false);
        return;
      }

      const link = `${window.location.origin}/call/${userToken}`;
      setTransferLink(link);
      // Automatic user movement requires a notification mechanism (WebSocket/SSE).
      // Reset warmStarted since transfer was completed
      setWarmStarted(false);
    } catch (err) {
      console.error("Failed to complete transfer:", err);
    } finally {
      setCompleting(false);
    }
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
            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {micOn ? "Mute" : "Unmute"}
          </button>

          <div className="flex-1 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                onClick={() => (warmStarted ? handleCompleteTransfer() : handleAddWarmTransfer())}
                className="flex-1 py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer"
              >
                {starting ? "Starting..." : completing ? "Completing..." : warmStarted ? "Complete Transfer" : "Start Warm Transfer"}
              </button>
              <button
                onClick={() => {
                  if (transferLink) navigator.clipboard?.writeText(transferLink);
                }}
                className="py-2 px-3 bg-slate-700 text-white rounded"
                disabled={!transferLink}
              >
                Copy Link
              </button>
            </div>
            {transferLink && <div className="text-sm text-gray-700 break-all">Transfer link: {transferLink}</div>}
          </div>

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


