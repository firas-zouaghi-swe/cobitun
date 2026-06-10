'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface BackgroundVideoProps {
  /** Path to MP4 video source (relative to /public) */
  srcMp4: string;
  /** Path to WebM video source (optional, relative to /public) */
  srcWebm?: string;
  /** Poster image fallback (relative to /public) */
  poster?: string;
  /** Accessible label describing the video content */
  ariaLabel?: string;
  /** Additional CSS class for the outermost container */
  className?: string;
  /** Overlay opacity (0 to 1). Default: 0.55 */
  overlayOpacity?: number;
  /** Enable vignette mask on edges. Default: true */
  vignette?: boolean;
  /** Disable video on mobile to save bandwidth (show poster only). Default: true */
  disableOnMobile?: boolean;
  /** Mobile breakpoint in px. Default: 768 */
  mobileBreakpoint?: number;
}

export default function BackgroundVideo({
  srcMp4,
  srcWebm,
  poster,
  ariaLabel = 'Background video showing the COBITUN platform experience',
  className = '',
  overlayOpacity = 0.55,
  vignette = true,
  disableOnMobile = true,
  mobileBreakpoint = 768,
}: BackgroundVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const playAttempted = useRef(false);

  // Detect mobile viewport and reduced-motion preference
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < mobileBreakpoint);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);

    return () => {
      window.removeEventListener('resize', checkMobile);
      mq.removeEventListener('change', handler);
    };
  }, [mobileBreakpoint]);

  // Whether video should be rendered at all
  const showVideo = !(disableOnMobile && isMobile) && !prefersReducedMotion;

  // Direct video loading + autoplay when component mounts
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showVideo) return;

    let mounted = true;

    const attemptPlay = () => {
      if (!mounted || playAttempted.current) return;
      playAttempted.current = true;

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            if (mounted) setIsVideoReady(true);
          })
          .catch((err) => {
            // Autoplay may be blocked; try muted autoplay
            video.muted = true;
            video.play()
              .then(() => { if (mounted) setIsVideoReady(true); })
              .catch(() => {
                // Give up — show poster fallback
                if (mounted) setVideoError(true);
              });
          });
      }
    };

    // Listen for video readiness events
    const onCanPlay = () => {
      if (mounted) {
        setIsVideoReady(true);
        attemptPlay();
      }
    };

    const onLoadedData = () => {
      if (mounted) {
        setIsVideoReady(true);
        attemptPlay();
      }
    };

    const onError = () => {
      if (mounted) setVideoError(true);
    };

    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('error', onError);

    // Safety timeout: if video doesn't become ready in 8s, mark as errored
    const safetyTimer = setTimeout(() => {
      if (mounted && !isVideoReady && !videoError) {
        // Safety timeout — mark as ready after 8s if not yet loaded
        setIsVideoReady(true);
      }
    }, 8000);

    return () => {
      mounted = false;
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('error', onError);
      clearTimeout(safetyTimer);
    };
  }, [showVideo]);

  // Toggle pause/play for accessibility
  const togglePause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPaused(false);
    } else {
      video.pause();
      setIsPaused(true);
    }
  }, []);

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
    >
      {/* ── Poster Fallback (shown when video is disabled or errored) ── */}
      {poster && (!showVideo || videoError) && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${poster})` }}
        />
      )}

      {/* ── Video Layer ── */}
      {showVideo && !videoError && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={poster}
          aria-hidden="true"
          className={`
            absolute inset-0 w-full h-full object-cover
            transition-opacity duration-1000 ease-out
            ${isVideoReady ? 'opacity-100' : 'opacity-0'}
          `}
          style={{
            scale: '1.02', // slight upscale to prevent edge gaps during playback
          }}
        >
          {srcWebm && <source src={srcWebm} type="video/webm" />}
          <source src={srcMp4} type="video/mp4" />
        </video>
      )}

      {/* ── Gradient Overlay ── */}
      <div
        className="absolute inset-0 z-[1] transition-opacity duration-700"
        style={{
          background: `linear-gradient(
            180deg,
            rgba(26, 26, 46, ${overlayOpacity + 0.15}) 0%,
            rgba(26, 26, 46, ${overlayOpacity}) 40%,
            rgba(26, 26, 46, ${overlayOpacity + 0.1}) 70%,
            rgba(26, 26, 46, ${overlayOpacity + 0.25}) 100%
          )`,
        }}
      />

      {/* ── Vignette Mask ── */}
      {vignette && (
        <div
          className="absolute inset-0 z-[2] pointer-events-none"
          style={{
            maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 40%, transparent 100%)',
            background: 'rgba(26, 26, 46, 0.35)',
          }}
        />
      )}

      {/* ── Bottom Edge Blend ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 z-[3] pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(26, 26, 46, 1) 0%, transparent 100%)',
        }}
      />

      {/* ── Top Edge Blend ── */}
      <div
        className="absolute top-0 left-0 right-0 h-24 z-[3] pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(26, 26, 46, 0.6) 0%, transparent 100%)',
        }}
      />

      {/* ── Accessible Pause Button ── */}
      {showVideo && !videoError && (
        <button
          onClick={togglePause}
          className={`
            absolute bottom-4 right-4 z-[10]
            w-9 h-9 rounded-full
            bg-white/10 backdrop-blur-sm
            border border-white/20
            flex items-center justify-center
            text-white/60 hover:text-white hover:bg-white/20
            transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-[#E5693A] focus:ring-offset-2 focus:ring-offset-transparent
            opacity-0 group-hover/hero:opacity-100 hover:opacity-100
          `}
          aria-label={isPaused ? 'Play background video' : 'Pause background video'}
          title={isPaused ? 'Play video' : 'Pause video'}
        >
          {isPaused ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="5" y="3" width="4" height="18" rx="1" />
              <rect x="15" y="3" width="4" height="18" rx="1" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

