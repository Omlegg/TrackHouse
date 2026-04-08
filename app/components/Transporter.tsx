"use client";

import * as Tone from "tone";
import { initAudio } from "@/lib/tone";

export default function Transporter() {

  const handlePlay = async () => {
    await initAudio(); // start audio context + transport
  };

  const handleStop = () => {
    Tone.getTransport().stop();
  };

  return (
    <div>
      <button onClick={handlePlay}>Play</button>
      <button onClick={handleStop}>Stop</button>
    </div>
  );
}