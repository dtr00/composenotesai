import { useState } from "react";

interface RemoteImageProps {
  src: string;
  className: string;
  onLoad: () => void;
}

export function RemoteImage({ src, className, onLoad }: RemoteImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className={className}
      onLoad={onLoad}
      onError={() => setFailed(true)}
    />
  );
}
