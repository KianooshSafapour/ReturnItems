"use client";

// اسکنر بارکد با دوربین — برای وقتی اسکنر سیمی در دسترس نیست؛
// دوربین گوشی/تبلت را باز می‌کند و بارکد (EAN-13، CODE128 و…) را می‌خواند
import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCw,
  ScanLine,
  SwitchCamera,
  VideoOff,
  Zap,
  ZapOff,
} from "lucide-react";
import { toFaDigits } from "@/lib/money";

interface CameraScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** با خوانده‌شدن هر بارکد صدا زده می‌شود — اسکن ادامه می‌یابد تا کاربر دیالوگ را ببندد */
  onDetected: (barcode: string) => void;
}

interface CameraDeviceLite {
  deviceId: string;
  label: string;
}

/** بوق موفقیت — بدون فایل صوتی، با WebAudio */
function playBeep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(760, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => void ctx.close();
  } catch {
    /* بی‌صدا رد شود */
  }
}

/** لرزش کوتاه روی موبایل */
function vibrateOk() {
  try {
    navigator.vibrate?.(60);
  } catch {
    /* پشتیبانی نمی‌شود */
  }
}

export function CameraScannerDialog({ open, onOpenChange, onDetected }: CameraScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  // نگه‌داشتن تابع بازگشتی در ref — تا هویت متغیر والد، دوربین را ری‌استارت نکند
  const onDetectedRef = useRef(onDetected);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  const [starting, setStarting] = useState(true);
  const [waitHint, setWaitHint] = useState(false);
  const [cameras, setCameras] = useState<CameraDeviceLite[]>([]);
  const [cameraIdx, setCameraIdx] = useState(0);
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>("");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [flashCode, setFlashCode] = useState<string | null>(null);

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  /** رشته ویدیوی فعال از عنصر ویدیو */
  const getActiveTrack = useCallback((): MediaStreamTrack | null => {
    const src = videoRef.current?.srcObject;
    if (src && "getVideoTracks" in src) {
      const track = (src as MediaStream).getVideoTracks()[0];
      if (track) return track;
    }
    return null;
  }, []);

  const startCamera = useCallback(
    async (deviceId?: string) => {
      if (!videoRef.current) return;
      setStarting(true);
      setWaitHint(false);
      setPermissionError(null);
      stopScanner();
      // اگر مرورگر منتظر تأییدیه دسترسی کاربر بماند، راهنما نشان بده
      const hintTimer = window.setTimeout(() => setWaitHint(true), 10000);

      const hints = new Map();
      const formats = [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
      ];
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 180,
        delayBetweenScanSuccess: 700,
      });

      try {
        const constraints: MediaStreamConstraints = deviceId
          ? { video: { deviceId: { exact: deviceId } } }
          : { video: { facingMode: { ideal: "environment" } } };

        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current,
          (result) => {
            if (!result) return;
            const text = result.getText().trim();
            const now = Date.now();
            // جلوگیری از خواندن تکراری همان بارکد طی ۲.۵ ثانیه
            if (text === lastScanRef.current.code && now - lastScanRef.current.at < 2500) return;
            lastScanRef.current = { code: text, at: now };

            playBeep();
            vibrateOk();
            setFlashCode(text);
            window.setTimeout(() => setFlashCode(null), 1600);

            onDetectedRef.current(text);
          }
        );
        controlsRef.current = controls;

        // فهرست دوربین‌ها + برچسب فعال
        try {
          const devices = (await BrowserMultiFormatReader.listVideoInputDevices()).map((d) => ({
            deviceId: d.deviceId,
            label: d.label || "دوربین",
          }));
          setCameras(devices);
          const track = getActiveTrack();
          const label = track?.label || devices[0]?.label || "";
          setActiveCameraLabel(label);
          const idx = devices.findIndex((d) => d.label === label);
          if (idx >= 0) setCameraIdx(idx);

          // بررسی پشتیبانی چراغ (فقط در موبایل معمولاً)
          const caps = track?.getCapabilities?.() as
            | { torch?: boolean }
            | undefined;
          setTorchSupported(!!caps?.torch);
          setTorchOn(false);
        } catch {
          /* فهرست دوربین‌ها اختیاری است */
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("Permission") || msg.includes("NotAllowed") || msg.includes("denied")) {
          setPermissionError(
            "دسترسی به دوربین رد شد. از تنظیمات مرورگر اجازه دسترسی دوربین را فعال کنید و دوباره تلاش کنید."
          );
        } else if (msg.includes("NotFound") || msg.includes("no camera") || msg.includes("devices")) {
          setPermissionError("دوربینی روی این دستگاه یافت نشد. از اسکنر سیمی یا ورود دستی استفاده کنید.");
        } else {
          setPermissionError(`راه‌اندازی دوربین ناموفق بود: ${msg}`);
        }
      } finally {
        window.clearTimeout(hintTimer);
        setWaitHint(false);
        setStarting(false);
      }
    },
    [stopScanner, getActiveTrack]
  );

  // راه‌اندازی هنگام باز شدن دیالوگ
  // نکته: محتوای دیالوگ Radix یک فریم دیرتر از تغییر open سوار می‌شود (الگوی Presence)
  // پس باید تا در دسترس شدن عنصر ویدیو با rAF منتظر ماند
  useEffect(() => {
    if (!open) {
      stopScanner();
      setFlashCode(null);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    const tryStart = () => {
      if (cancelled) return;
      if (videoRef.current) {
        void startCamera();
        return;
      }
      if (++attempts <= 60) {
        // حداکثر ~۵ ثانیه صبر برای سوار شدن محتوای دیالوگ
        requestAnimationFrame(tryStart);
      }
    };
    tryStart();
    return () => {
      cancelled = true;
      stopScanner();
    };
  }, [open, startCamera, stopScanner]);

  /** خاموش/روشن کردن چراغ */
  async function toggleTorch() {
    const track = getActiveTrack();
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as unknown as MediaTrackConstraintSet],
      } as MediaTrackConstraints);
      setTorchOn((t) => !t);
    } catch {
      setTorchSupported(false);
      toast.error("چراغ دوربین در این دستگاه در دسترس نیست");
    }
  }

  function switchCamera() {
    if (cameras.length < 2) return;
    const next = (cameraIdx + 1) % cameras.length;
    setCameraIdx(next);
    void startCamera(cameras[next].deviceId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 text-right">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5 text-primary" />
            اسکن بارکد با دوربین
          </DialogTitle>
          <DialogDescription>
            بارکد کالا را داخل کادر قرار دهید — خواندن خودکار انجام می‌شود و می‌توانید چند قلم را
            پشت‌سرهنگ اسکن کنید.
          </DialogDescription>
        </DialogHeader>

        {/* نمای دوربین */}
        <div className="relative mx-5 mb-4 overflow-hidden rounded-2xl border-2 border-primary/30 bg-black/95 aspect-[4/3]">
          <video
            ref={videoRef}
            className="absolute inset-0 size-full object-cover"
            muted
            playsInline
            aria-label="پیش‌نمایش دوربین"
          />

          {/* چهار گوشه نوری + خط اسکن متحرک */}
          {!permissionError && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0">
              <div className="absolute inset-6 rounded-xl border border-white/10" />
              <div className="absolute top-6 right-6 size-10 rounded-tr-2xl border-t-4 border-r-4 border-primary shadow-[0_0_18px_var(--tw-shadow-color)] shadow-primary/40" />
              <div className="absolute top-6 left-6 size-10 rounded-tl-2xl border-t-4 border-l-4 border-primary shadow-[0_0_18px_var(--tw-shadow-color)] shadow-primary/40" />
              <div className="absolute bottom-6 right-6 size-10 rounded-br-2xl border-b-4 border-r-4 border-primary shadow-[0_0_18px_var(--tw-shadow-color)] shadow-primary/40" />
              <div className="absolute bottom-6 left-6 size-10 rounded-bl-2xl border-b-4 border-l-4 border-primary shadow-[0_0_18px_var(--tw-shadow-color)] shadow-primary/40" />
              <motion.div
                initial={{ top: "12%" }}
                animate={{ top: ["12%", "84%", "12%"] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute right-10 left-10 h-0.5 rounded-full bg-primary/80 shadow-[0_0_14px_2px] shadow-primary/60"
              />
            </div>
          )}

          {/* حالت بارگذاری */}
          {starting && !permissionError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 p-6 text-center backdrop-blur-sm">
              <Loader2 className="size-9 animate-spin text-primary" />
              <p className="text-xs font-semibold text-primary-foreground/90">
                در حال روشن کردن دوربین…
              </p>
              {waitHint && (
                <p className="max-w-xs text-[11px] leading-5 text-primary-foreground/70">
                  اگر مرورگر برای اجازه دسترسی به دوربین پرسیده، روی «اجازه دادن» بزنید.
                  در صورت رد شدن دسترسی، از اسکنر سیمی یا ورود دستی استفاده کنید.
                </p>
              )}
            </div>
          )}

          {/* خطای دسترسی */}
          {permissionError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 p-6 text-center backdrop-blur-sm">
              <div className="flex size-16 items-center justify-center rounded-full border border-destructive/40 bg-destructive/15">
                {permissionError.includes("دوربینی") ? (
                  <VideoOff className="size-8 text-destructive" />
                ) : (
                  <CameraOff className="size-8 text-destructive" />
                )}
              </div>
              <p className="max-w-xs text-xs leading-6 text-primary-foreground/90">
                {permissionError}
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="font-semibold"
                onClick={() => void startCamera(cameras[cameraIdx]?.deviceId)}
              >
                <RefreshCw className="size-4" />
                تلاش دوباره
              </Button>
            </div>
          )}

          {/* فلش موفقیت خواندن بارکد */}
          <AnimatePresence>
            {flashCode && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="absolute inset-x-4 bottom-4 flex items-center gap-2.5 rounded-xl border border-primary/50 bg-primary/15 px-3.5 py-2.5 backdrop-blur-md"
              >
                <CheckCircle2 className="size-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-primary-foreground/80">بارکد خوانده شد</p>
                  <p dir="ltr" className="num truncate text-sm font-extrabold text-white">
                    {toFaDigits(flashCode)}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* نوار ابزار شناور */}
          {!permissionError && !starting && (
            <div className="absolute top-3 left-3 flex gap-1.5">
              {cameras.length > 1 && (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="size-9 rounded-xl bg-black/55 text-white backdrop-blur-md hover:bg-black/75"
                  onClick={switchCamera}
                  aria-label="تعویض دوربین"
                  title="تعویض دوربین"
                >
                  <SwitchCamera className="size-4" />
                </Button>
              )}
              {torchSupported && (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className={
                    "size-9 rounded-xl backdrop-blur-md " +
                    (torchOn
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-black/55 text-white hover:bg-black/75")
                  }
                  onClick={() => void toggleTorch()}
                  aria-label={torchOn ? "خاموش کردن چراغ" : "روشن کردن چراغ"}
                  title={torchOn ? "خاموش کردن چراغ" : "روشن کردن چراغ"}
                >
                  {torchOn ? <Zap className="size-4" /> : <ZapOff className="size-4" />}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* وضعیت پایین */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/40 px-5 py-3">
          <p className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <ScanLine className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">
              {activeCameraLabel ? activeCameraLabel : starting ? "در حال آماده‌سازی…" : "دوربین فعال"}
            </span>
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="font-semibold">
            <RotateCw className="size-4" />
            بستن و بازگشت به فرم
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
