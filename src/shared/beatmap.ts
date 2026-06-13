export type Beat = {
  time: number;        // ms
  direction: "left" | "right" | "up" | "down";
};

export type Beatmap = {
  songName: string;
  bpm: number;
  beats: Beat[];
};