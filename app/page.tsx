"use client";

/* eslint-disable @next/next/no-img-element */
/* eslint-disable @next/next/no-html-link-for-pages */
import * as fal from "@fal-ai/serverless-client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { ModelIcon } from "@/components/icons/model-icon";
import Link from "next/link";
import { io } from 'socket.io-client';
import { ModelIconDeepgram } from "@/components/icons/model-icon-deepgram";

let connected = false;
let socket;
const DEFAULT_PROMPT =
  "A cat in an astronaut space suit";

function randomSeed() {
  return Math.floor(Math.random() * 10000000).toFixed(0);
}

fal.config({
  proxyUrl: "/api/proxy",
});

const INPUT_DEFAULTS = {
  _force_msgpack: new Uint8Array([]),
  enable_safety_checker: true,
  image_size: "square_hd",
  sync_mode: true,
  num_images: 1,
  num_inference_steps: "2",
};

export default function Lightning() {
  const [image, setImage] = useState<null | string>(null);
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  const [seed, setSeed] = useState<string>(randomSeed());
  const [inferenceTime, setInferenceTime] = useState<number>(NaN);

  const connection = fal.realtime.connect("fal-ai/fast-lightning-sdxl", {
    connectionKey: "lightning-sdxl",
    throttleInterval: 64,
    onResult: (result) => {
      const blob = new Blob([result.images[0].content], { type: "image/jpeg" });
      setImage(URL.createObjectURL(blob));
      setInferenceTime(result.timings.inference);
    },
  });

  const timer = useRef<any | undefined>(undefined);

  const handleOnChange = async (prompt: string) => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    setPrompt(prompt);
    const input = {
      ...INPUT_DEFAULTS,
      prompt: prompt,
      seed: seed ? Number(seed) : Number(randomSeed()),
    };
    connection.send(input);
    timer.current = setTimeout(() => {
      connection.send({ ...input, num_inference_steps: "4" });
    }, 500);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.document.cookie = "fal-app=true; path=/; samesite=strict; secure;";
    }
    // initial image
    connection.send({
      ...INPUT_DEFAULTS,
      num_inference_steps: "4",
      prompt: prompt,
      seed: seed ? Number(seed) : Number(randomSeed()),
    });

    if(!connected){
      connected = true;
      // Deepgram
      socket = io('ws://localhost:3001', ({ transports: ["websocket"] }));
    
      socket.on("connect", async () => {
        // connected = true;
        console.log("client: connected to websocket");
        await start(socket);
      });
    
      socket.on("transcript", (transcript) => {
        if (transcript !== "")
          handleOnChange(transcript);
          // captions.innerHTML = transcript ? `<span>${transcript}</span>` : "";
      });
    }
  }, []);

  // Deeepgram
  // const captions = window.document.getElementById("captions");

  async function getMicrophone() {
    const userMedia = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
  
    return new MediaRecorder(userMedia);
  }
  
  async function openMicrophone(microphone, socket) {
    await microphone.start(500);
  
    microphone.onstart = () => {
      console.log("client: microphone opened");
      document.body.classList.add("recording");
    };
  
    microphone.onstop = () => {
      console.log("client: microphone closed");
      document.body.classList.remove("recording");
    };
  
    microphone.ondataavailable = (e) => {
      console.log("client: sent data to websocket");
      socket.emit("packet-sent", e.data);
    };
  }
  
  async function closeMicrophone(microphone) {
    microphone.stop();
  }
  
  async function start(socket) {
    let microphone;
  
    console.log("client: waiting to open microphone");
  
    // listenButton.addEventListener("click", async () => {
      if (!microphone) {
        // open and close the microphone
        microphone = await getMicrophone();
        await openMicrophone(microphone, socket);
      } else {
        await closeMicrophone(microphone);
        microphone = undefined;
      }
    // });
  }


  // Deepgram

  return (
    <main>
      <div className="flex flex-col justify-between h-[calc(100vh-56px)]">
        <div className="py-4 md:py-10 px-0 space-y-4 lg:space-y-8 mx-auto w-full max-w-xl">
          <div className="container px-3 md:px-0 flex flex-col space-y-2">
            <div className="flex flex-col max-md:space-y-4 md:flex-row md:space-x-4 max-w-full">
              <div className="flex-1 space-y-1">
                <label>Prompt</label>
                <Input
                  onChange={(e) => {
                    handleOnChange(e.target.value);
                  }}
                  className="font-light w-full"
                  placeholder="Type something..."
                  value={prompt}
                />
              </div>
              <div className="space-y-1">
                <label>Seed</label>
                <Input
                  onChange={(e) => {
                    setSeed(e.target.value);
                    handleOnChange(prompt);
                  }}
                  className="font-light w-28"
                  placeholder="random"
                  type="number"
                  value={seed}
                />
              </div>
            </div>
          </div>
          <div className="container flex flex-col space-y-6 lg:flex-row lg:space-y-0 p-3 md:p-0">
            <div className="flex-1 flex-col flex items-center justify-center">
              {image && inferenceTime && (
                <div className="flex flex-row space-x-1 text-sm w-full mb-2">
                  <span className="text-neutral-500">Inference time:</span>
                  <span
                    className={
                      !inferenceTime ? "text-neutral-500" : "text-green-400"
                    }
                  >
                    {inferenceTime
                      ? `${(inferenceTime * 1000).toFixed(0)}ms`
                      : `n/a`}
                  </span>
                </div>
              )}
              <div className="md:min-h-[512px] max-w-fit">
                {image && (
                  <img id="imageDisplay" src={image} alt="Dynamic Image" />
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="container flex flex-col items-center justify-center my-4">
          <div className="flex flex-row items-center space-x-2">
            <span className="text-xs font-mono">powered by</span>
            <Link href="https://deepgram.com" target="_blank">
              <ModelIconDeepgram />
            </Link>
            +
            <Link href="https://fal.ai" target="_blank">
              <ModelIcon />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
