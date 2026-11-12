"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type CustomChannel = { name: string; url: string };
type BuiltInChannel = { title: string; path: string };

type Props = {
  channels: BuiltInChannel[];
  selectedPath: string | undefined;
  onBuiltInSelect: (path: string) => void;
  onCustomSelect: (url: string, name: string) => void;
};

export default function CustomChannelSelect({
  channels,
  selectedPath,
  onBuiltInSelect,
  onCustomSelect,
}: Props) {
  const [custom, setCustom] = useState<CustomChannel[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [value, setValue] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/custom-channels", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { channels?: CustomChannel[] }) => {
        if (alive) setCustom(data.channels || []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setValue(selectedPath ? `builtin:${selectedPath}` : "");
  }, [selectedPath]);

  return (
    <div className="relative">
      <select
        aria-label="Kanal seç"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          if (next.startsWith("builtin:")) {
            onBuiltInSelect(next.slice(8));
          } else if (next.startsWith("custom:")) {
            const channel = custom[Number(next.slice(7))];
            if (channel) onCustomSelect(channel.url, channel.name);
          }
        }}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm font-medium text-white focus:border-red-600 focus:outline-none"
      >
        <optgroup label="Turis Tv kanalları">
          {channels.map((channel, index) => (
            <option key={channel.path} value={`builtin:${channel.path}`}>
              {index + 1}. {channel.title}
            </option>
          ))}
        </optgroup>
        {custom.length > 0 && (
          <optgroup label="Özel kanallarım">
            {custom.map((channel, index) => (
              <option key={`${channel.name}-${channel.url}`} value={`custom:${index}`}>
                {channel.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {!loaded && (
        <Loader2 className="pointer-events-none absolute right-8 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-zinc-500" />
      )}
    </div>
  );
}
