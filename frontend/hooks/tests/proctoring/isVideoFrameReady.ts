const isVideoFrameReady = (video: HTMLVideoElement | null): video is HTMLVideoElement => {
  if (!video) {
    return false;
  }

  return (
    video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
    video.videoWidth > 0 &&
    video.videoHeight > 0 &&
    !video.paused &&
    !video.ended
  );
};

export default isVideoFrameReady;
