import { z } from "zod";
import { toErrorMessage } from "@/Shared/Errors/ErrorMessage";
import { type ThreadListResponse, ThreadListResponseSchema } from "../DomainModel/ThreadGroupTypes";

const ThreadListCacheKeySchema = z.string().trim().min(1);
const ThreadListSnapshotMaximumEntriesSchema = z.number().int().positive();
const ThreadListSnapshotPersistedAtSchema = z.number().int().nonnegative();
const DEFAULT_THREAD_LIST_SNAPSHOT_MAXIMUM_ENTRIES = 16;
const THREAD_LIST_SNAPSHOT_DATABASE_NAME = "farfield-thread-list-snapshot-cache.v1";
const THREAD_LIST_SNAPSHOT_DATABASE_VERSION = 1;
const THREAD_LIST_SNAPSHOT_OBJECT_STORE_NAME = "threadListSnapshots";
const THREAD_LIST_SNAPSHOT_OBJECT_STORE_KEY_PATH = "cacheKey";
const THREAD_LIST_SNAPSHOT_PERSISTED_AT_INDEX_NAME = "persistedAt";
const THREAD_LIST_SNAPSHOT_READ_OPERATION = "thread-list-snapshot:read";
const THREAD_LIST_SNAPSHOT_WRITE_OPERATION = "thread-list-snapshot:write";
const THREAD_LIST_SNAPSHOT_CLEAR_OPERATION = "thread-list-snapshot:clear";
const THREAD_LIST_SNAPSHOT_DATABASE_OPEN_OPERATION = "thread-list-snapshot:open-database";
const THREAD_LIST_SNAPSHOT_DATABASE_REQUEST_FAILED_MESSAGE = "IndexedDB request failed";
const THREAD_LIST_SNAPSHOT_DATABASE_TRANSACTION_FAILED_MESSAGE = "IndexedDB transaction failed";

const ThreadListSnapshotRecordSchema = z
  .object({
    cacheKey: ThreadListCacheKeySchema,
    response: ThreadListResponseSchema,
    persistedAt: ThreadListSnapshotPersistedAtSchema,
  })
  .strict();
type ThreadListSnapshotRecord = z.infer<typeof ThreadListSnapshotRecordSchema>;
const ThreadListSnapshotRecordCollectionSchema = z.array(ThreadListSnapshotRecordSchema);

export interface ThreadListSnapshotPersistenceStore {
  readThreadListSnapshot(cacheKey: string): Promise<ThreadListResponse | null>;
  writeThreadListSnapshot(cacheKey: string, response: ThreadListResponse): Promise<void>;
  clearThreadListSnapshot(cacheKey: string): Promise<void>;
}

interface ThreadListSnapshotIndexedDatabaseStoreDependencies {
  indexedDatabaseFactory?: IDBFactory;
  readCurrentEpochMilliseconds?: () => number;
}

function createThreadListSnapshotStorageError<ErrorType>(
  operation: string,
  error: ErrorType,
): Error {
  return new Error(`${operation}: ${toErrorMessage(error).trim()}`);
}

/**
 * Owns IndexedDB persistence for thread-list snapshots.
 *
 * Ownership contract:
 * 1. Key strategy: thread-list cache key string (`threads:active`, `threads:archived`).
 * 2. Invalidation strategy: owners clear specific keys when thread mutations invalidate list caches.
 * 3. Bounds strategy: records are capped by `maximumEntries`, evicting oldest `persistedAt`.
 * 4. Persistence strategy: reads are explicit at startup while writes are non-blocking.
 */
export class ThreadListSnapshotIndexedDatabaseStore implements ThreadListSnapshotPersistenceStore {
  private readonly indexedDatabaseFactory: IDBFactory | null;
  private readonly readCurrentEpochMilliseconds: () => number;
  private readonly maximumEntries: number;
  private readonly inMemoryRecordByCacheKey: Map<string, ThreadListSnapshotRecord>;
  private databaseConnectionPromise: Promise<IDBDatabase> | null;

  public constructor(
    maximumEntries = DEFAULT_THREAD_LIST_SNAPSHOT_MAXIMUM_ENTRIES,
    dependencies?: ThreadListSnapshotIndexedDatabaseStoreDependencies,
  ) {
    this.indexedDatabaseFactory =
      dependencies?.indexedDatabaseFactory ?? (typeof indexedDB === "undefined" ? null : indexedDB);
    this.readCurrentEpochMilliseconds = dependencies?.readCurrentEpochMilliseconds ?? Date.now;
    this.maximumEntries = ThreadListSnapshotMaximumEntriesSchema.parse(maximumEntries);
    this.inMemoryRecordByCacheKey = new Map<string, ThreadListSnapshotRecord>();
    this.databaseConnectionPromise = null;
  }

  public async readThreadListSnapshot(cacheKey: string): Promise<ThreadListResponse | null> {
    const parsedCacheKey = ThreadListCacheKeySchema.parse(cacheKey);
    if (this.indexedDatabaseFactory === null) {
      return this.inMemoryRecordByCacheKey.get(parsedCacheKey)?.response ?? null;
    }

    try {
      const database = await this.readDatabaseConnection();
      const transaction = database.transaction(THREAD_LIST_SNAPSHOT_OBJECT_STORE_NAME, "readonly");
      const objectStore = transaction.objectStore(THREAD_LIST_SNAPSHOT_OBJECT_STORE_NAME);
      const rawRecord = await this.waitForRequest(objectStore.get(parsedCacheKey));
      await this.waitForTransaction(transaction);

      if (rawRecord === undefined) {
        return null;
      }

      const parsedRecord = ThreadListSnapshotRecordSchema.parse(rawRecord);
      return parsedRecord.response;
    } catch (error) {
      throw createThreadListSnapshotStorageError(THREAD_LIST_SNAPSHOT_READ_OPERATION, error);
    }
  }

  public async writeThreadListSnapshot(
    cacheKey: string,
    response: ThreadListResponse,
  ): Promise<void> {
    const parsedCacheKey = ThreadListCacheKeySchema.parse(cacheKey);
    const parsedResponse = ThreadListResponseSchema.parse(response);
    const snapshotRecord = ThreadListSnapshotRecordSchema.parse({
      cacheKey: parsedCacheKey,
      response: parsedResponse,
      persistedAt: this.readCurrentEpochMilliseconds(),
    });
    if (this.indexedDatabaseFactory === null) {
      this.inMemoryRecordByCacheKey.set(parsedCacheKey, snapshotRecord);
      this.evictInMemoryEntriesBeyondLimit();
      return;
    }

    try {
      const database = await this.readDatabaseConnection();
      const writeTransaction = database.transaction(
        THREAD_LIST_SNAPSHOT_OBJECT_STORE_NAME,
        "readwrite",
      );
      const writeObjectStore = writeTransaction.objectStore(THREAD_LIST_SNAPSHOT_OBJECT_STORE_NAME);
      writeObjectStore.put(snapshotRecord);
      await this.waitForTransaction(writeTransaction);
      await this.evictEntriesBeyondLimit(database);
    } catch (error) {
      throw createThreadListSnapshotStorageError(THREAD_LIST_SNAPSHOT_WRITE_OPERATION, error);
    }
  }

  public async clearThreadListSnapshot(cacheKey: string): Promise<void> {
    const parsedCacheKey = ThreadListCacheKeySchema.parse(cacheKey);
    if (this.indexedDatabaseFactory === null) {
      this.inMemoryRecordByCacheKey.delete(parsedCacheKey);
      return;
    }

    try {
      const database = await this.readDatabaseConnection();
      const transaction = database.transaction(THREAD_LIST_SNAPSHOT_OBJECT_STORE_NAME, "readwrite");
      const objectStore = transaction.objectStore(THREAD_LIST_SNAPSHOT_OBJECT_STORE_NAME);
      objectStore.delete(parsedCacheKey);
      await this.waitForTransaction(transaction);
    } catch (error) {
      throw createThreadListSnapshotStorageError(THREAD_LIST_SNAPSHOT_CLEAR_OPERATION, error);
    }
  }

  private async evictEntriesBeyondLimit(database: IDBDatabase): Promise<void> {
    const readTransaction = database.transaction(
      THREAD_LIST_SNAPSHOT_OBJECT_STORE_NAME,
      "readonly",
    );
    const readObjectStore = readTransaction.objectStore(THREAD_LIST_SNAPSHOT_OBJECT_STORE_NAME);
    const rawRecords = await this.waitForRequest(readObjectStore.getAll());
    await this.waitForTransaction(readTransaction);
    const parsedRecords = ThreadListSnapshotRecordCollectionSchema.parse(rawRecords);
    if (parsedRecords.length <= this.maximumEntries) {
      return;
    }

    const orderedByNewestFirst = [...parsedRecords].sort(
      (leftRecord, rightRecord) => rightRecord.persistedAt - leftRecord.persistedAt,
    );
    const evictedCacheKeys = orderedByNewestFirst
      .slice(this.maximumEntries)
      .map((record) => record.cacheKey);
    if (evictedCacheKeys.length === 0) {
      return;
    }

    const writeTransaction = database.transaction(
      THREAD_LIST_SNAPSHOT_OBJECT_STORE_NAME,
      "readwrite",
    );
    const writeObjectStore = writeTransaction.objectStore(THREAD_LIST_SNAPSHOT_OBJECT_STORE_NAME);
    for (const evictedCacheKey of evictedCacheKeys) {
      writeObjectStore.delete(evictedCacheKey);
    }
    await this.waitForTransaction(writeTransaction);
  }

  private readDatabaseConnection(): Promise<IDBDatabase> {
    if (this.indexedDatabaseFactory === null) {
      return Promise.reject(
        new Error("IndexedDB is unavailable for thread-list snapshot storage."),
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
        reject(new Error("IndexedDB is unavailable for thread-list snapshot storage."));
        return;
      }
      const openRequest = this.indexedDatabaseFactory.open(
        THREAD_LIST_SNAPSHOT_DATABASE_NAME,
        THREAD_LIST_SNAPSHOT_DATABASE_VERSION,
      );

      openRequest.onupgradeneeded = () => {
        const database = openRequest.result;
        let objectStore: IDBObjectStore;
        if (database.objectStoreNames.contains(THREAD_LIST_SNAPSHOT_OBJECT_STORE_NAME)) {
          const upgradeTransaction = openRequest.transaction;
          if (upgradeTransaction === null) {
            reject(new Error("Thread list snapshot upgrade transaction is unavailable."));
            return;
          }
          objectStore = upgradeTransaction.objectStore(THREAD_LIST_SNAPSHOT_OBJECT_STORE_NAME);
        } else {
          objectStore = database.createObjectStore(THREAD_LIST_SNAPSHOT_OBJECT_STORE_NAME, {
            keyPath: THREAD_LIST_SNAPSHOT_OBJECT_STORE_KEY_PATH,
          });
        }
        if (!objectStore.indexNames.contains(THREAD_LIST_SNAPSHOT_PERSISTED_AT_INDEX_NAME)) {
          objectStore.createIndex(
            THREAD_LIST_SNAPSHOT_PERSISTED_AT_INDEX_NAME,
            THREAD_LIST_SNAPSHOT_PERSISTED_AT_INDEX_NAME,
          );
        }
      };

      openRequest.onsuccess = () => {
        resolve(openRequest.result);
      };
      openRequest.onerror = () => {
        reject(
          createThreadListSnapshotStorageError(
            THREAD_LIST_SNAPSHOT_DATABASE_OPEN_OPERATION,
            openRequest.error ?? new Error(THREAD_LIST_SNAPSHOT_DATABASE_REQUEST_FAILED_MESSAGE),
          ),
        );
      };
    });
  }

  private evictInMemoryEntriesBeyondLimit(): void {
    if (this.inMemoryRecordByCacheKey.size <= this.maximumEntries) {
      return;
    }
    const orderedByNewestFirst = [...this.inMemoryRecordByCacheKey.entries()].sort(
      (leftEntry, rightEntry) => rightEntry[1].persistedAt - leftEntry[1].persistedAt,
    );
    this.inMemoryRecordByCacheKey.clear();
    for (const [cacheKey, record] of orderedByNewestFirst.slice(0, this.maximumEntries)) {
      this.inMemoryRecordByCacheKey.set(cacheKey, record);
    }
  }

  private waitForRequest<ResultType>(request: IDBRequest<ResultType>): Promise<ResultType> {
    const indexedDatabaseRequest = request;
    return new Promise<ResultType>((resolve, reject) => {
      indexedDatabaseRequest.onsuccess = () => {
        resolve(indexedDatabaseRequest.result);
      };
      indexedDatabaseRequest.onerror = () => {
        reject(
          indexedDatabaseRequest.error ??
            new Error(THREAD_LIST_SNAPSHOT_DATABASE_REQUEST_FAILED_MESSAGE),
        );
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
            new Error(THREAD_LIST_SNAPSHOT_DATABASE_TRANSACTION_FAILED_MESSAGE),
        );
      };
      indexedDatabaseTransaction.onabort = () => {
        reject(
          indexedDatabaseTransaction.error ??
            new Error(THREAD_LIST_SNAPSHOT_DATABASE_TRANSACTION_FAILED_MESSAGE),
        );
      };
    });
  }
}
