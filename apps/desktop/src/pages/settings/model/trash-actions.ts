import {
  clearTrash,
  deleteForever,
  reportTrashError,
  restoreFromTrash,
} from "../../../entities/note/model/trash-store";
import { refreshStorageUsage } from "./storage-usage";

const thenRefreshStorage = (work: Promise<unknown>) => void reportTrashError(work).then(refreshStorageUsage);

export const restoreTrashItem = (id: number) => thenRefreshStorage(restoreFromTrash([id]));

export const deleteTrashItem = (id: number) => thenRefreshStorage(deleteForever([id]));

export const emptyTrashForGood = () => thenRefreshStorage(clearTrash());
