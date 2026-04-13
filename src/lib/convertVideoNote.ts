const TARGET_SIZE = 640;
const MAX_DURATION = 60;
const TARGET_FPS = 30;

export interface ConvertProgress {
  phase: "loading" | "converting" | "encoding";
  percent: number;
}

export async function convertToVideoNote(
  file: File,
  onProgress?: (p: ConvertProgress) => void
): Promise<File> {
  onProgress?.({ phase: "loading", percent: 0 });

  const videoUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.playsInline = true;
  video.preload = "auto";
  video.volume = 0;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Не удалось загрузить видео"));
    video.src = videoUrl;
  });

  const duration = Math.min(video.duration, MAX_DURATION);
  const srcW = video.videoWidth;
  const srcH = video.videoHeight;
  const cropSize = Math.min(srcW, srcH);
  const cropX = (srcW - cropSize) / 2;
  const cropY = (srcH - cropSize) / 2;

  onProgress?.({ phase: "loading", percent: 100 });

  const canvas = document.createElement("canvas");
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext("2d")!;

  const stream = canvas.captureStream(TARGET_FPS);

  let audioCtx: AudioContext | null = null;
  try {
    audioCtx = new AudioContext();
    const source = audioCtx.createMediaElementSource(video);
    const dest = audioCtx.createMediaStreamDestination();
    source.connect(dest);
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  } catch {
    // no audio track — ok
  }

  const chunks: Blob[] = [];

  const mimeTypes = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  let selectedMime = "";
  for (const mt of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mt)) {
      selectedMime = mt;
      break;
    }
  }
  if (!selectedMime) {
    throw new Error("Браузер не поддерживает запись видео. Используйте Chrome или Firefox.");
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: selectedMime,
    videoBitsPerSecond: 1_500_000,
  });

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingDone = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  recorder.start(100);

  video.currentTime = 0;
  await video.play();

  onProgress?.({ phase: "converting", percent: 0 });

  await new Promise<void>((resolve) => {
    const drawFrame = () => {
      if (video.paused || video.ended || video.currentTime >= duration) {
        recorder.stop();
        video.pause();
        resolve();
        return;
      }

      ctx.drawImage(
        video,
        cropX, cropY, cropSize, cropSize,
        0, 0, TARGET_SIZE, TARGET_SIZE
      );

      const pct = Math.min(100, Math.round((video.currentTime / duration) * 100));
      onProgress?.({ phase: "converting", percent: pct });

      requestAnimationFrame(drawFrame);
    };
    requestAnimationFrame(drawFrame);
  });

  await recordingDone;
  onProgress?.({ phase: "encoding", percent: 100 });

  URL.revokeObjectURL(videoUrl);
  if (audioCtx) audioCtx.close().catch(() => {});

  const blob = new Blob(chunks, { type: selectedMime });
  const ext = selectedMime.includes("mp4") ? "mp4" : "webm";
  return new File([blob], `circle_${Date.now()}.${ext}`, { type: blob.type });
}