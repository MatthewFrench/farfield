import {
  AppServerReadThreadResponseSchema,
  FarfieldThreadLiveStateSnapshotSchema,
  FarfieldThreadStreamEventsSnapshotSchema,
} from "@farfield/protocol";
import { z } from "zod";
import { AgentIdSchema } from "@/Shared/Contracts/ApiContracts";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import type {
  ChatLiveStateResponse,
  ChatReadThreadResponse,
  ChatStreamEventsResponse,
} from "./ChatServerClient";

const ThreadIdentifierSchema = z.string().trim().min(1);
const PositiveIntegerSchema = z.number().int().positive();
const PersistedAtSchema = z.number().int().nonnegative();
const StreamEventsSinceSequenceSchema = z.number().int().nonnegative().nullable();
const DEFAULT_SELECTED_THREAD_SNAPSHOT_MAXIMUM_ENTRIES = 48;
const SELECTED_THREAD_SNAPSHOT_DATABASE_NAME = "farfield-selected-thread-snapshot-cache.v1";
const SELECTED_THREAD_SNAPSHOT_DATABASE_VERSION = 1;
const SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_NAME = "selectedThreadSnapshots";
const SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_KEY_PATH = "threadId";
const SELECTED_THREAD_SNAPSHOT_PERSISTED_AT_INDEX_NAME = "persistedAt";
const SELECTED_THREAD_SNAPSHOT_READ_OPERATION = "selected-thread-snapshot:read";
const SELECTED_THREAD_SNAPSHOT_WRITE_OPERATION = "selected-thread-snapshot:write";
const SELECTED_THREAD_SNAPSHOT_CLEAR_OPERATION = "selected-thread-snapshot:clear";
const SELECTED_THREAD_SNAPSHOT_DATABASE_OPEN_OPERATION = "selected-thread-snapshot:open-database";
const INDEXED_DATABASE_REQUEST_FAILED_MESSAGE = "IndexedDB request failed";
const INDEXED_DATABASE_TRANSACTION_FAILED_MESSAGE = "IndexedDB transaction failed";

const ReadThreadSnapshotSchema = AppServerReadThreadResponseSchema.extend({
  agentId: AgentIdSchema,
});

export interface SelectedThreadSnapshotCacheRecord {
  threadId: string;
  liveStateSnapshot: ChatLiveStateResponse;
  streamEventsSnapshot: ChatStreamEventsResponse;
  streamEventsSinceSequenceUsed: number | null;
  readThreadSnapshot: ChatReadThreadResponse | null;
  includeTurnsUsedForRead: boolean;
}

const SelectedThreadSnapshotCacheRecordSchema = z
  .object({
    threadId: ThreadIdentifierSchema,
    liveStateSnapshot: FarfieldThreadLiveStateSnapshotSchema,
    streamEventsSnapshot: FarfieldThreadStreamEventsSnapshotSchema,
    streamEventsSinceSequenceUsed: StreamEventsSinceSequenceSchema,
    readThreadSnapshot: ReadThreadSnapshotSchema.nullable(),
    includeTurnsUsedForRead: z.boolean(),
  })
  .strict();

const PersistedSelectedThreadSnapshotRecordSchema = SelectedThreadSnapshotCacheRecordSchema.extend({
  persistedAt: PersistedAtSchema,
}).strict();
type PersistedSelectedThreadSnapshotRecord = z.infer<
  typeof PersistedSelectedThreadSnapshotRecordSchema
>;
const PersistedSelectedThreadSnapshotRecordCollectionSchema = z.array(
  PersistedSelectedThreadSnapshotRecordSchema,
);

export interface SelectedThreadSnapshotCacheStore {
  readSnapshot(threadId: string): Promise<SelectedThreadSnapshotCacheRecord | null>;
  writeSnapshot(snapshot: SelectedThreadSnapshotCacheRecord): Promise<void>;
  clearSnapshot(threadId: string): Promise<void>;
}

interface SelectedThreadSnapshotIndexedDatabaseStoreDependencies {
  indexedDatabaseFactory?: IDBFactory;
  readCurrentEpochMilliseconds?: () => number;
}

function createSelectedThreadSnapshotStorageError<ErrorType>(
  operation: string,
  error: ErrorType,
): Error {
  return new Error(`${operation}: ${toErrorMessage(error).trim()}`);
}

/**
 * Owns IndexedDB persistence for selected-thread snapshot hydration.
 *
 * Ownership contract:
 * 1. Key strategy: records are keyed by thread identifier.
 * 2. Invalidation strategy: owners clear per-thread snapshots when canonical state is reset.
 * 3. Bounds strategy: prune oldest snapshots by `persistedAt` beyond `maximumEntries`.
 * 4. Snapshot contract: persisted payloads are parsed through strict Zod contracts on read/write.
 */
export class SelectedThreadSnapshotIndexedDatabaseStore
  implements SelectedThreadSnapshotCacheStore
{
  private readonly indexedDatabaseFactory: IDBFactory | null;
  private readonly readCurrentEpochMilliseconds: () => number;
  private readonly maximumEntries: number;
  private readonly inMemorySnapshotByThreadIdentifier: Map<
    string,
    PersistedSelectedThreadSnapshotRecord
  >;
  private databaseConnectionPromise: Promise<IDBDatabase> | null;

  public constructor(
    maximumEntries = DEFAULT_SELECTED_THREAD_SNAPSHOT_MAXIMUM_ENTRIES,
    dependencies?: SelectedThreadSnapshotIndexedDatabaseStoreDependencies,
  ) {
    this.indexedDatabaseFactory =
      dependencies?.indexedDatabaseFactory ?? (typeof indexedDB === "undefined" ? null : indexedDB);
    this.readCurrentEpochMilliseconds = dependencies?.readCurrentEpochMilliseconds ?? Date.now;
    this.maximumEntries = PositiveIntegerSchema.parse(maximumEntries);
    this.inMemorySnapshotByThreadIdentifier = new Map<
      string,
      PersistedSelectedThreadSnapshotRecord
    >();
    this.databaseConnectionPromise = null;
  }

  public async readSnapshot(threadId: string): Promise<SelectedThreadSnapshotCacheRecord | null> {
    const parsedThreadId = ThreadIdentifierSchema.parse(threadId);
    if (this.indexedDatabaseFactory === null) {
      const persistedSnapshot = this.inMemorySnapshotByThreadIdentifier.get(parsedThreadId);
      if (persistedSnapshot === undefined) {
        return null;
      }
      return SelectedThreadSnapshotCacheRecordSchema.parse({
        threadId: persistedSnapshot.threadId,
        liveStateSnapshot: persistedSnapshot.liveStateSnapshot,
        streamEventsSnapshot: persistedSnapshot.streamEventsSnapshot,
        streamEventsSinceSequenceUsed: persistedSnapshot.streamEventsSinceSequenceUsed,
        readThreadSnapshot: persistedSnapshot.readThreadSnapshot,
        includeTurnsUsedForRead: persistedSnapshot.includeTurnsUsedForRead,
      });
    }

    try {
      const database = await this.readDatabaseConnection();
      const transaction = database.transaction(
        SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_NAME,
        "readonly",
      );
      const objectStore = transaction.objectStore(SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_NAME);
      const rawRecord = await this.waitForRequest(objectStore.get(parsedThreadId));
      await this.waitForTransaction(transaction);
      if (rawRecord === undefined) {
        return null;
      }

      const parsedRecord = PersistedSelectedThreadSnapshotRecordSchema.parse(rawRecord);
      return SelectedThreadSnapshotCacheRecordSchema.parse({
        threadId: parsedRecord.threadId,
        liveStateSnapshot: parsedRecord.liveStateSnapshot,
        streamEventsSnapshot: parsedRecord.streamEventsSnapshot,
        streamEventsSinceSequenceUsed: parsedRecord.streamEventsSinceSequenceUsed,
        readThreadSnapshot: parsedRecord.readThreadSnapshot,
        includeTurnsUsedForRead: parsedRecord.includeTurnsUsedForRead,
      });
    } catch (error) {
      throw createSelectedThreadSnapshotStorageError(
        SELECTED_THREAD_SNAPSHOT_READ_OPERATION,
        error,
      );
    }
  }

  public async writeSnapshot(snapshot: SelectedThreadSnapshotCacheRecord): Promise<void> {
    const parsedSnapshot = SelectedThreadSnapshotCacheRecordSchema.parse(snapshot);
    const persistedSnapshot = PersistedSelectedThreadSnapshotRecordSchema.parse({
      ...parsedSnapshot,
      persistedAt: this.readCurrentEpochMilliseconds(),
    });
    if (this.indexedDatabaseFactory === null) {
      this.inMemorySnapshotByThreadIdentifier.set(parsedSnapshot.threadId, persistedSnapshot);
      this.evictInMemoryEntriesBeyondLimit();
      return;
    }

    try {
      const database = await this.readDatabaseConnection();
      const writeTransaction = database.transaction(
        SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_NAME,
        "readwrite",
      );
      const writeObjectStore = writeTransaction.objectStore(
        SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_NAME,
      );
      writeObjectStore.put(persistedSnapshot);
      await this.waitForTransaction(writeTransaction);
      await this.evictEntriesBeyondLimit(database);
    } catch (error) {
      throw createSelectedThreadSnapshotStorageError(
        SELECTED_THREAD_SNAPSHOT_WRITE_OPERATION,
        error,
      );
    }
  }

  public async clearSnapshot(threadId: string): Promise<void> {
    const parsedThreadId = ThreadIdentifierSchema.parse(threadId);
    if (this.indexedDatabaseFactory === null) {
      this.inMemorySnapshotByThreadIdentifier.delete(parsedThreadId);
      return;
    }

    try {
      const database = await this.readDatabaseConnection();
      const transaction = database.transaction(
        SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_NAME,
        "readwrite",
      );
      const objectStore = transaction.objectStore(SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_NAME);
      objectStore.delete(parsedThreadId);
      await this.waitForTransaction(transaction);
    } catch (error) {
      throw createSelectedThreadSnapshotStorageError(
        SELECTED_THREAD_SNAPSHOT_CLEAR_OPERATION,
        error,
      );
    }
  }

  private async evictEntriesBeyondLimit(database: IDBDatabase): Promise<void> {
    const readTransaction = database.transaction(
      SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_NAME,
      "readonly",
    );
    const readObjectStore = readTransaction.objectStore(SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_NAME);
    const rawRecords = await this.waitForRequest(readObjectStore.getAll());
    await this.waitForTransaction(readTransaction);
    const parsedRecords = PersistedSelectedThreadSnapshotRecordCollectionSchema.parse(rawRecords);
    if (parsedRecords.length <= this.maximumEntries) {
      return;
    }

    const orderedByNewestFirst = [...parsedRecords].sort(
      (leftRecord, rightRecord) => rightRecord.persistedAt - leftRecord.persistedAt,
    );
    const evictedThreadIds = orderedByNewestFirst
      .slice(this.maximumEntries)
      .map((record) => record.threadId);
    if (evictedThreadIds.length === 0) {
      return;
    }

    const writeTransaction = database.transaction(
      SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_NAME,
      "readwrite",
    );
    const writeObjectStore = writeTransaction.objectStore(
      SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_NAME,
    );
    for (const evictedThreadId of evictedThreadIds) {
      writeObjectStore.delete(evictedThreadId);
    }
    await this.waitForTransaction(writeTransaction);
  }

  private readDatabaseConnection(): Promise<IDBDatabase> {
    if (this.indexedDatabaseFactory === null) {
      return Promise.reject(
        new Error("IndexedDB is unavailable for selected-thread snapshot storage."),
      );
    }
    if (this.databaseConnectionPromise === null) {
      this.databaseConnectionPromise = this.openDatabaseConnection();
    }
    return this.databaseConnectionPromise;
  }

  private openDatabaseConnection(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      if (this.indexedDatabaseFactory === null) {
        reject(new Error("IndexedDB is unavailable for selected-thread snapshot storage."));
        return;
      }
      const openRequest = this.indexedDatabaseFactory.open(
        SELECTED_THREAD_SNAPSHOT_DATABASE_NAME,
        SELECTED_THREAD_SNAPSHOT_DATABASE_VERSION,
      );

      openRequest.onupgradeneeded = () => {
        const database = openRequest.result;
        let objectStore: IDBObjectStore;
        if (database.objectStoreNames.contains(SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_NAME)) {
          const upgradeTransaction = openRequest.transaction;
          if (upgradeTransaction === null) {
            reject(new Error("Selected thread snapshot upgrade transaction is unavailable."));
            return;
          }
          objectStore = upgradeTransaction.objectStore(SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_NAME);
        } else {
          objectStore = database.createObjectStore(SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_NAME, {
            keyPath: SELECTED_THREAD_SNAPSHOT_OBJECT_STORE_KEY_PATH,
          });
        }

        if (!objectStore.indexNames.contains(SELECTED_THREAD_SNAPSHOT_PERSISTED_AT_INDEX_NAME)) {
          objectStore.createIndex(
            SELECTED_THREAD_SNAPSHOT_PERSISTED_AT_INDEX_NAME,
            SELECTED_THREAD_SNAPSHOT_PERSISTED_AT_INDEX_NAME,
          );
        }
      };

      openRequest.onsuccess = () => {
        resolve(openRequest.result);
      };
      openRequest.onerror = () => {
        reject(
          createSelectedThreadSnapshotStorageError(
            SELECTED_THREAD_SNAPSHOT_DATABASE_OPEN_OPERATION,
            openRequest.error ?? new Error(INDEXED_DATABASE_REQUEST_FAILED_MESSAGE),
          ),
        );
      };
    });
  }

  private evictInMemoryEntriesBeyondLimit(): void {
    if (this.inMemorySnapshotByThreadIdentifier.size <= this.maximumEntries) {
      return;
    }
    const orderedByNewestFirst = [...this.inMemorySnapshotByThreadIdentifier.entries()].sort(
      (leftEntry, rightEntry) => rightEntry[1].persistedAt - leftEntry[1].persistedAt,
    );
    this.inMemorySnapshotByThreadIdentifier.clear();
    for (const [threadIdentifier, record] of orderedByNewestFirst.slice(0, this.maximumEntries)) {
      this.inMemorySnapshotByThreadIdentifier.set(threadIdentifier, record);
    }
  }

  private waitForRequest<ResultType>(request: IDBRequest<ResultType>): Promise<ResultType> {
    const indexedDatabaseRequest = request;
    return new Promise<ResultType>((resolve, reject) => {
      indexedDatabaseRequest.onsuccess = () => {
        resolve(indexedDatabaseRequest.result);
      };
      indexedDatabaseRequest.onerror = () => {
        reject(indexedDatabaseRequest.error ?? new Error(INDEXED_DATABASE_REQUEST_FAILED_MESSAGE));
      };
    });
  }

  private waitForTransaction(transaction: IDBTransaction): Promise<void> {
    const indexedDatabaseTransaction = transaction;
    return new Promise<void>((resolve, reject) => {
      indexedDatabaseTransaction.oncomplete = () => {
        resolve();
      };
      indexedDatabaseTransaction.onerror = () => {
        reject(
          indexedDatabaseTransaction.error ??
            new Error(INDEXED_DATABASE_TRANSACTION_FAILED_MESSAGE),
        );
      };
      indexedDatabaseTransaction.onabort = () => {
        reject(
          indexedDatabaseTransaction.error ??
            new Error(INDEXED_DATABASE_TRANSACTION_FAILED_MESSAGE),
        );
      };
    });
  }
}
