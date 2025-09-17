"use client";
import { useState } from "react";
import { MdCall } from "react-icons/md";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const joinCall = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      console.log("URL", process.env.NEXT_PUBLIC_SERVER_URL);

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/agent-token`,{
          roomName: "test",
        }
      );
      const data = response.data;

      setToken(data.data.token);
      console.log("Token", data.data.token);
      router.push(`/call/${data.data.token}`);
    } catch (error) {
      console.error("error in joining call by user", error);
      throw error;
    }
  };
  return (
    <form
      className="h-screen w-full text-center flex flex-col justify-evenly"
      onSubmit={joinCall}
    >
      <h1 className="text-5xl font-semibold">
        {" "}
        Welcome to RelayCall an Attack Capital assignment project
      </h1>
      <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-1/4 self-center mt-10 cursor-pointer flex justify-center items-center">
        <MdCall className="mx-3" /> Join Call
      </button>
    </form>
  );
}
