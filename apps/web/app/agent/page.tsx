"use client";
import { useState } from "react";
import { MdCall } from "react-icons/md";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [userIdentity, setUserIdentity] = useState("");
  const [transferLink, setTransferLink] = useState("");
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);

  const joinCall = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/agent-token`,
        {
          roomName: "test",
        }
      );
      const data = response.data;
      setToken(data.data.token);
      router.push(`/call/agent/${data.data.token}`);
    } catch (error) {
      console.error("error in joining call by agent", error);
      throw error;
    }
  };

  // Start warm transfer: get agent token for support room and navigate agent to support
  async function startWarm() {
    try {
      setStarting(true);
      const res = await axios.post(`${process.env.NEXT_PUBLIC_SERVER_URL}/start-warm-transfer`, {
        roomName: "test",
        agentIdentity: "Agent 1",
      });
      const t = res.data.data.token;
      setStarting(false);
      // navigate agent to support room to prepare
      router.push(`/call/agent/${t}`);
    } catch (err) {
      console.error(err);
      setStarting(false);
    }
  }

  // Complete transfer: request a user token for support room and expose link for agent to copy/send
  async function completeTransfer() {
    if (!userIdentity) {
      alert("Enter the user's identity (as they joined) to generate a transfer link");
      return;
    }
    try {
      setCompleting(true);
      const res = await axios.post(`${process.env.NEXT_PUBLIC_SERVER_URL}/complete-transfer`, {
        roomName: "test",
        userIdentity,
      });
      const userToken = res.data.data.token;
      const link = `${location.origin}/call/${userToken}`;
      setTransferLink(link);
      setCompleting(false);
    } catch (err) {
      console.error(err);
      setCompleting(false);
    }
  }

  return (
    <form className="h-screen w-full text-center flex flex-col justify-evenly" onSubmit={joinCall}>
      <h1 className="text-5xl font-semibold"> Welcome to RelayCall an Attack Capital assignment project</h1>

      <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-1/4 self-center mt-10" onClick={joinCall}>
        <MdCall className="mx-3" /> Join as Agent
      </button>

      <div className="max-w-md mx-auto mt-8 space-y-4">
        <div>
          <button className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded" onClick={(e) => { e.preventDefault(); startWarm(); }} disabled={starting}>
            {starting ? "Starting..." : "Start Warm Transfer"}
          </button>
          <p className="text-sm text-gray-600 mt-2">Agent will get a support-room token and can join to prep the transfer.</p>
        </div>

        <div className="mt-4">
          <input
            type="text"
            placeholder="Enter user identity (as they joined)"
            className="border rounded p-2 w-full"
            value={userIdentity}
            onChange={(e) => setUserIdentity(e.target.value)}
          />
          <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded mt-2" onClick={(e) => { e.preventDefault(); completeTransfer(); }} disabled={completing}>
            {completing ? "Completing..." : "Complete Transfer (generate link)"}
          </button>
          {transferLink && (
            <div className="mt-2">
              <input readOnly className="w-full border rounded p-2" value={transferLink} />
              <button
                className="mt-2 bg-slate-700 text-white px-3 py-1 rounded"
                onClick={(e) => {
                  e.preventDefault();
                  navigator.clipboard?.writeText(transferLink);
                }}
              >
                Copy Transfer Link
              </button>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
