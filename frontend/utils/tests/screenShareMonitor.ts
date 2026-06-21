type ScreenShareListener = () => void;

const activeTracks = new Set<MediaStreamTrack>();
const listeners = new Set<ScreenShareListener>();
let patchInstalled = false;
let originalGetDisplayMedia: (typeof navigator.mediaDevices)["getDisplayMedia"] | undefined;

const notifyListeners = () => {
  listeners.forEach((listener) => {
    listener();
  });
};

export const registerScreenShareTrack = (track: MediaStreamTrack) => {
  if (track.readyState === "ended") {
    return;
  }

  activeTracks.add(track);
  track.addEventListener(
    "ended",
    () => {
      activeTracks.delete(track);
      notifyListeners();
    },
    { once: true },
  );
  notifyListeners();
};

export const isScreenSharingActive = () => {
  for (const track of activeTracks) {
    if (track.readyState === "live") {
      return true;
    }

    activeTracks.delete(track);
  }

  return false;
};

export const subscribeScreenShare = (listener: ScreenShareListener) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

export const initScreenShareMonitor = () => {
  if (patchInstalled || !navigator.mediaDevices?.getDisplayMedia) {
    return;
  }

  patchInstalled = true;
  originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);

  navigator.mediaDevices.getDisplayMedia = async (constraints) => {
    const stream = await originalGetDisplayMedia!(constraints);
    stream.getVideoTracks().forEach(registerScreenShareTrack);
    return stream;
  };
};

export const resetScreenShareMonitor = () => {
  activeTracks.clear();
  notifyListeners();
};
