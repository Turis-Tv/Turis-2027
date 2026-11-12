import { CHANNELS } from "../lib/channels.js";
import { isUnlocked, json } from "../lib/core.js";

export async function onRequestGet({ request, env }) {
  const unlocked = await isUnlocked(request, env);
  const channels = CHANNELS.map((channel, index) => ({
    id: index + 1,
    title: channel.title,
    path: channel.path,
    status: "ok",
    m3u8Url: unlocked ? channel.m3u8Url : null,
    kodk: unlocked ? channel.kodk : null,
    kos: unlocked ? channel.kos : null,
  }));
  return json({ locked: !unlocked, channels });
}
