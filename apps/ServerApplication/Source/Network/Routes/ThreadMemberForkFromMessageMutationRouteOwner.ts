import {
  readForkThreadFromMessageRollbackCount,
  ThreadForkFromMessageRollbackCountError,
} from "../../Modules/Threads/ThreadForkFromMessageRollbackCount.js";
import { parseForkThreadFromMessageBody } from "../RequestSchemas/HttpSchemas.js";
import {
  isThreadMemberSubresourceRoute,
  ThreadMemberMutationActionByName,
  type ThreadMemberResolvedRouteContext,
  type ThreadMemberRouteDependencies,
  ThreadMemberRouteMethodByName,
  ThreadMemberRouteSegmentByName,
} from "./ThreadMemberRouteContracts.js";

const THREAD_FORK_FROM_MESSAGE_ROLLBACK_UNSUPPORTED_ERROR =
  "Agent does not support rollback required for fork-from-message";

class ThreadMemberForkFromMessageRouteError extends Error {
  public readonly statusCode: number;

  public constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ThreadMemberForkFromMessageRouteError";
    this.statusCode = statusCode;
  }
}

export interface ThreadMemberForkFromMessageMutationRouteOwnerOptions {
  dependencies: ThreadMemberRouteDependencies;
  context: ThreadMemberResolvedRouteContext;
}

/**
 * Owns the Farfield-only `/api/threads/:threadId/fork-message` mutation.
 * The route resolves the selected message to a containing turn, forks the source
 * thread, and then trims the forked thread to that turn boundary.
 */
export class ThreadMemberForkFromMessageMutationRouteOwner {
  private readonly dependencies: ThreadMemberRouteDependencies;
  private readonly context: ThreadMemberResolvedRouteContext;

  public constructor(options: ThreadMemberForkFromMessageMutationRouteOwnerOptions) {
    this.dependencies = options.dependencies;
    this.context = options.context;
  }

  public async handle(): Promise<boolean> {
    const {
      req,
      readJsonBody,
      threadConcurrencyCoordinator,
      pushActionEventWithRequestContext,
      pushActionErrorWithRequestContext,
      invalidateThreadListAggregationCache,
      jsonResponse,
    } = this.dependencies;
    const { adapter, agentId, threadId } = this.context;

    if (
      !(
        req.method === ThreadMemberRouteMethodByName.post &&
        isThreadMemberSubresourceRoute(
          this.dependencies.segments,
          ThreadMemberRouteSegmentByName.forkMessage,
        )
      )
    ) {
      return false;
    }

    const parsedBody = parseForkThreadFromMessageBody(await readJsonBody(req));
    const forkThread = adapter.forkThread;
    if (!forkThread) {
      jsonResponse(this.dependencies.res, 400, {
        ok: false,
        error: `Agent ${agentId} does not support thread fork`,
        threadId,
      });
      return true;
    }

    pushActionEventWithRequestContext(
      ThreadMemberMutationActionByName.threadForkFromMessage,
      "attempt",
      {
        agentId,
        threadId,
        messageId: parsedBody.messageId,
      },
    );

    try {
      const forkPreparationResult = await threadConcurrencyCoordinator.runExclusive(
        threadId,
        async () => {
          const readThreadResult = await adapter.readThread({
            threadId,
            includeTurns: true,
          });
          const rollbackTurnCount = readForkThreadFromMessageRollbackCount(
            readThreadResult.thread,
            parsedBody.messageId,
          );

          if (rollbackTurnCount > 0 && !adapter.rollbackThread) {
            throw new ThreadMemberForkFromMessageRouteError(
              400,
              `Agent ${agentId} ${THREAD_FORK_FROM_MESSAGE_ROLLBACK_UNSUPPORTED_ERROR}`,
            );
          }

          const forkResult = await forkThread({
            threadId,
          });

          return {
            forkResult,
            rollbackTurnCount,
          };
        },
      );

      if (forkPreparationResult.rollbackTurnCount > 0) {
        const rollbackThread = adapter.rollbackThread;
        if (!rollbackThread) {
          throw new ThreadMemberForkFromMessageRouteError(
            400,
            `Agent ${agentId} ${THREAD_FORK_FROM_MESSAGE_ROLLBACK_UNSUPPORTED_ERROR}`,
          );
        }

        await threadConcurrencyCoordinator.runExclusive(
          forkPreparationResult.forkResult.threadId,
          async () => {
            await rollbackThread({
              threadId: forkPreparationResult.forkResult.threadId,
              numTurns: forkPreparationResult.rollbackTurnCount,
            });
          },
        );
      }

      pushActionEventWithRequestContext(
        ThreadMemberMutationActionByName.threadForkFromMessage,
        "success",
        {
          agentId,
          threadId,
          forkedThreadId: forkPreparationResult.forkResult.threadId,
          messageId: parsedBody.messageId,
          rollbackTurnCount: forkPreparationResult.rollbackTurnCount,
        },
      );
      invalidateThreadListAggregationCache("thread-forked", {
        agentId,
        threadId,
        forkedThreadId: forkPreparationResult.forkResult.threadId,
        messageId: parsedBody.messageId,
      });
      jsonResponse(this.dependencies.res, 200, {
        ok: true,
        threadId: forkPreparationResult.forkResult.threadId,
        sourceThreadId: threadId,
        sourceMessageId: parsedBody.messageId,
      });
    } catch (error) {
      if (
        error instanceof ThreadMemberForkFromMessageRouteError ||
        error instanceof ThreadForkFromMessageRollbackCountError
      ) {
        const message = error.message;
        const statusCode =
          error instanceof ThreadMemberForkFromMessageRouteError ? error.statusCode : 400;
        pushActionErrorWithRequestContext(
          ThreadMemberMutationActionByName.threadForkFromMessage,
          error,
          {
            agentId,
            threadId,
            messageId: parsedBody.messageId,
          },
        );
        jsonResponse(this.dependencies.res, statusCode, {
          ok: false,
          error: message,
          threadId,
        });
        return true;
      }

      const message = pushActionErrorWithRequestContext(
        ThreadMemberMutationActionByName.threadForkFromMessage,
        error,
        {
          agentId,
          threadId,
          messageId: parsedBody.messageId,
        },
      );
      jsonResponse(this.dependencies.res, 500, {
        ok: false,
        error: message,
        threadId,
      });
    }

    return true;
  }
}
