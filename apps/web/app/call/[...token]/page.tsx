"use client";

import { useState, useEffect } from "react";
import { LiveKitRoom, ControlBar, useRoomContext } from "@livekit/components-react";
import { useParams } from "next/navigation";

import type { 
  LocalParticipant, 
  RemoteParticipant, 
  TrackPublication, 
  Track, 
  Participant,
  Room,
} from "livekit-client";

/* ------------------- Debug Components ------------------- */

function AudioLogger() {
  const room = useRoomContext();
  useEffect(() => {
    if (!room) return;

    const onTrackPublished = (
      publication: TrackPublication,
      participant: LocalParticipant | RemoteParticipant
    ) => {
      if (publication.kind === "audio" && participant.isLocal) {
        console.log("[AUDIO SEND] Local audio published:", {
          participant: participant.identity,
          trackSid: publication.trackSid,
          isMuted: publication.isMuted,
        });
      }
    };

    const onTrackSubscribed = (
      track: Track,
      publication: TrackPublication,
      participant: Participant
    ) => {
      if (track.kind === "audio" && !participant.isLocal) {
        console.log("[AUDIO RECV] Subscribed to remote audio:", {
          participant: participant.identity,
          trackSid: publication.trackSid,
          isMuted: publication.isMuted,
          track,
        });
      }
    };

    room.on("trackPublished", onTrackPublished);
    room.on("trackSubscribed", onTrackSubscribed);

    return () => {
      room.off("trackPublished", onTrackPublished);
      room.off("trackSubscribed", onTrackSubscribed);
    };
  }, [room]);

  return null;
}

function ConnectionDebugInfo() {
  const room = useRoomContext();
  const [state, setState] = useState({
    connectionState: "",
    localTracks: 0,
    remoteTracks: 0,
    numParticipants: 0,
    remoteParticipants: [] as Array<{ identity: string; tracks: number; isSpeaking: boolean }>,
  });

  useEffect(() => {
    if (!room) return;

    const interval = setInterval(() => {
      const remoteParticipantsInfo = Array.from(room.remoteParticipants.values()).map((p) => ({
        identity: p.identity,
        tracks: p.trackPublications?.size || 0,
        isSpeaking: !!p.isSpeaking,
      }));

      setState({
        connectionState: room.state,
        localTracks: room.localParticipant.trackPublications?.size || 0,
        remoteTracks: Array.from(room.remoteParticipants.values()).reduce(
          (count, p) => count + (p.trackPublications?.size || 0),
          0
        ),
        numParticipants: room.remoteParticipants.size + 1,
        remoteParticipants: remoteParticipantsInfo,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [room]);

  return (
    <div className="fixed top-5 right-5 bg-black/60 text-white p-3 rounded text-sm">
      <div>Connection: <span className="font-bold">{state.connectionState}</span></div>
      <div>Participants: <span className="font-bold">{state.numParticipants}</span></div>
      <div>Local Tracks: <span className="font-bold">{state.localTracks}</span></div>
      <div>Remote Tracks: <span className="font-bold">{state.remoteTracks}</span></div>

      <div className="mt-2">
        <div className="font-bold">Remote Participants:</div>
        {state.remoteParticipants.length === 0 ? (
          <div className="text-gray-400">None</div>
        ) : (
          state.remoteParticipants.map((p) => (
            <div key={p.identity} className="flex justify-between">
              <span>{p.identity}</span>
              <span className={p.isSpeaking ? "text-green-400" : "text-gray-400"}>
                {p.tracks} tracks {p.isSpeaking ? "(speaking)" : ""}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------- Main Page ------------------- */

export default function VoiceCallPage() {
  const params = useParams() as { token: string | string[] };
  const token = Array.isArray(params.token) ? params.token.join("") : params.token;
  const [joined, setJoined] = useState(false);

  if (!joined) {
    return (
      <div className="h-screen flex flex-col items-center justify-center">
        <button
          className="bg-blue-500 text-white px-6 py-3 rounded-lg text-xl"
          onClick={() => setJoined(true)}
        >
          Join Call
        </button>
        <p className="mt-4 text-sm text-gray-600">
          Click to join call and allow microphone access
        </p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
      connect={true}
      audio={true} // ✅ enable LiveKit audio (auto subscribe + autoplay handling)
      video={false}
      style={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Enable mic once connected */}
      <AutoEnableMic />
      <AudioLogger />
      <ConnectionDebugInfo />
      <AudioFallbackButton />
      <ControlBar controls={{ camera: false, screenShare: false, microphone: true }} />
    </LiveKitRoom>
  );
}

/* ------------------- Helper Components ------------------- */

function AutoEnableMic() {
  const room = useRoomContext();
  useEffect(() => {
    if (room) {
      room.localParticipant.setMicrophoneEnabled(true).catch(console.error);
    }
  }, [room]);
  return null;
}

function AudioFallbackButton() {
  return (
    <button
      className="fixed bottom-5 right-5 bg-yellow-500 text-black px-3 py-1 rounded"
      onClick={() => {
        document.querySelectorAll("audio").forEach((a) =>
          a.play().catch((err) => console.error("Play failed:", err))
        );
      }}
    >
      Enable Audio
    </button>
  );
}
