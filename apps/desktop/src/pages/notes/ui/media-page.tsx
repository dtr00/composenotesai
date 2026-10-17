import { useCallback, useState } from "react";
import { useMedia, useNoteListStatus } from "../../../entities/note/model/note-list-store";
import { mediaSource } from "../../../shared/api/notes";
import { DocumentView } from "./document-view";

export function MediaPage({ id }: { id: number }) {
  const media = useMedia(id);
  const { loading } = useNoteListStatus();
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);

  if (!media) return loading ? null : <p className="m-auto text-muted-foreground">This file no longer exists.</p>;
  if (failed) {
    return <p className="m-auto text-muted-foreground">This {media.mediaType} could not be shown.</p>;
  }

  if (media.mediaType === "document") return <DocumentView media={media} onError={fail} />;

  const shared = {
    className: "max-h-full max-w-full rounded-md object-contain",
    onError: fail,
  };

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      {media.mediaType === "video" ? (
        <video key={id} src={mediaSource(id)} aria-label={media.name} controls playsInline {...shared} />
      ) : (
        <img src={mediaSource(id)} alt={media.name} {...shared} />
      )}
    </div>
  );
}
