"use client";

import { useState } from "react";
import PianoRoll from "./components/PianoRoll";
import PlaylistTrack from "./components/PlaylistTrack";

type Note = {
  id: string;
  time: number;
  duration: number;
  pitch: string;
};

let pattern_id = 0;
type Pattern = {
  id: number;
  name: string;
  start: number;
  notes: Note[];
  duration: number;
};

let patterns = [] as Pattern[];


export default function Home() {

  return (
    <div>
      <main>
        <PlaylistTrack/>
      </main>
    </div>
  );
}
