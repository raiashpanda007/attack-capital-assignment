"use client";
import { useState } from "react";
import { MdCall } from "react-icons/md";
import axios from "axios";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
   const joinCall = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if(!name){
        setError("Please add your good name");
        return;
      }
      console.log("URL",process.env.NEXT_PUBLIC_SERVER_URL);

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_SERVER_URL}/create-token`,
        {
          userName:name,
          roomName: "ashu-123",
          roomType: "main",
        }
      );
      const data = response.data;

        setToken(data.data.token);
        setError("");
        console.log("Token",data.data.token);
        router.push(`/call/${data.data.token}`);

    } catch (error) {
      console.error("error in joining call by user", error);
      throw error;
    }
  };
  return (
    <form className="h-screen w-full text-center flex flex-col justify-evenly" onSubmit={joinCall}>
      <h1 className="text-5xl font-semibold">
        {" "}
        Welcome to RelayCall an Attack Capital assignment project
      </h1>
      <h3 className="text-2xl font-medium opacity-70">
        Please enter your name and click on Join Call to enter the call
      </h3>
      <input
        type="text"
        placeholder="Enter your name"
        className="border border-gray-300 rounded-lg p-3 w-1/4 self-center mt-5 outline-none focus:ring-2 focus:ring-blue-500"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {error && <p className="text-red-500 mt-2">{error}</p>}
      <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-1/4 self-center mt-10 cursor-pointer flex justify-center items-center">
        <MdCall className="mx-3" /> Join Call
      </button>
    </form>
  );
}
