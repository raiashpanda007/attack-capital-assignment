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

  async function startWarm() {
    try {
      setStarting(true);
      const res = await axios.post(`${process.env.NEXT_PUBLIC_SERVER_URL}/start-warm-transfer`, {
        roomName: "test",
        agentIdentity: "Agent 1",
      });
      const t = res.data.data.token;
      setStarting(false);
      router.push(`/call/agent/${t}`);
    } catch (err) {
      console.error(err);
      setStarting(false);
    }
  }

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

      <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-1/4 flex self-center mt-10 cursor-pointer items-center justify-center" onClick={joinCall}>
        <MdCall className="mx-3" /> Join as Agent
      </button>

    </form>
  );
}
